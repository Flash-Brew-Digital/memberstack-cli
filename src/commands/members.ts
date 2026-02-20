import { writeFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import yoctoSpinner from "yocto-spinner";
import { RATE_LIMIT_DELAY_MS } from "../lib/constants.js";
import { readInputFile, writeOutputFile } from "../lib/csv.js";
import { graphqlRequest } from "../lib/graphql-client.js";
import type {
  Member,
  MembersBulkAddPlanOptions,
  MembersBulkUpdateOptions,
  MembersCreateOptions,
  MembersExportOptions,
  MembersFindOptions,
  MembersImportOptions,
  MembersListOptions,
  MembersUpdateOptions,
  PlanOptions,
} from "../lib/types.js";
import {
  delay,
  parseJsonString,
  parseKeyValuePairs,
  printError,
  printRecord,
  printSuccess,
  printTable,
} from "../lib/utils.js";

const MEMBERS_OUTPUT_FILE = "members.json";

const MEMBER_FIELDS = `
  id
  createdAt
  lastLogin
  auth { email }
  customFields
  metaData
  json
  loginRedirect
  permissions { all }
  planConnections {
    id
    status
    type
    active
    plan { id name }
  }
`;

const printMemberPreview = (member: Member): void => {
  process.stderr.write(`\n  ${pc.dim("Preview:")}\n`);
  process.stderr.write(`  ${pc.bold("ID:")}      ${member.id}\n`);
  process.stderr.write(`  ${pc.bold("Email:")}   ${member.auth.email}\n`);
  process.stderr.write(
    `  ${pc.bold("Plans:")}   ${member.planConnections.length}\n`
  );
  process.stderr.write(`  ${pc.bold("Created:")} ${member.createdAt}\n`);
  process.stderr.write("\n");
};

const fetchAllMembers = async (
  spinner: ReturnType<typeof yoctoSpinner>,
  order = "ASC",
  filters?: Record<string, unknown>
): Promise<{ members: Member[]; totalCount: number }> => {
  const allMembers: Member[] = [];
  let cursor: string | undefined;
  let totalCount = 0;

  const pageSize = 200;

  do {
    const result = await graphqlRequest<{
      getMembers: {
        edges: { cursor: string; node: Member }[];
      };
    }>({
      query: `query($first: Int, $after: String, $order: OrderByInput, $filters: MemberFilter) {
        getMembers(first: $first, after: $after, order: $order, filters: $filters) {
          edges { cursor node { ${MEMBER_FIELDS} } }
        }
      }`,
      variables: { first: pageSize, after: cursor, order, filters },
    });

    const { edges } = result.getMembers;
    allMembers.push(...edges.map((e) => e.node));

    if (edges.length === pageSize) {
      cursor = edges.at(-1)?.cursor;
      spinner.text = `Fetching members... (${allMembers.length} so far)`;
    } else {
      cursor = undefined;
    }
  } while (cursor);

  totalCount = allMembers.length;

  return { members: allMembers, totalCount };
};

const flattenMember = (member: Member): Record<string, unknown> => ({
  id: member.id,
  email: member.auth.email,
  createdAt: member.createdAt,
  lastLogin: member.lastLogin ?? "",
  loginRedirect: member.loginRedirect ?? "",
  permissions: member.permissions.all.join(", "),
  plans: member.planConnections.map((p) => p.plan.id).join(", "),
  ...Object.fromEntries(
    Object.entries(member.customFields ?? {}).map(([k, v]) => [
      `customFields.${k}`,
      v,
    ])
  ),
  ...Object.fromEntries(
    Object.entries(member.metaData ?? {}).map(([k, v]) => [`metaData.${k}`, v])
  ),
});

const extractPrefixedFields = (
  row: Record<string, string>
): {
  customFields: Record<string, string>;
  metaData: Record<string, string>;
} => {
  const customFields: Record<string, string> = {};
  const metaData: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith("customFields.") && value) {
      customFields[key.slice("customFields.".length)] = value;
    } else if (key.startsWith("metaData.") && value) {
      metaData[key.slice("metaData.".length)] = value;
    }
  }
  return { customFields, metaData };
};

const applyPrefixedFields = (
  body: Record<string, unknown>,
  customFields: Record<string, string>,
  metaData: Record<string, string>
): void => {
  if (Object.keys(customFields).length > 0) {
    body.customFields = customFields;
  }
  if (Object.keys(metaData).length > 0) {
    body.metaData = metaData;
  }
};

const buildImportInput = (
  row: Record<string, string>
): Record<string, unknown> => {
  const input: Record<string, unknown> = {
    email: row.email,
    password: row.password,
  };

  if (row.plans) {
    input.plans = row.plans
      .split(",")
      .map((p: string) => ({ planId: p.trim() }));
  }
  if (row.loginRedirect) {
    input.loginRedirect = row.loginRedirect;
  }

  const { customFields, metaData } = extractPrefixedFields(row);
  applyPrefixedFields(input, customFields, metaData);

  return input;
};

const buildUpdateInput = (
  row: Record<string, string>,
  memberId: string
): Record<string, unknown> => {
  const input: Record<string, unknown> = { memberId };
  if (row.loginRedirect) {
    input.loginRedirect = row.loginRedirect;
  }

  const { customFields, metaData } = extractPrefixedFields(row);
  applyPrefixedFields(input, customFields, metaData);

  return input;
};

const collect = (value: string, previous: string[]): string[] => [
  ...previous,
  value,
];

export const membersCommand = new Command("members")
  .usage("<command> [options]")
  .description("Manage members");

membersCommand
  .command("list")
  .description("List members")
  .option(
    "--after <cursor>",
    "Pagination cursor (endCursor from previous page)"
  )
  .option("--order <order>", "Sort order (ASC or DESC)", "ASC")
  .option("--limit <number>", "Max members to return (default: 50, max: 200)")
  .option("--all", "Auto-paginate and fetch all members")
  .action(async (options: MembersListOptions) => {
    const spinner = yoctoSpinner({ text: "Fetching members..." }).start();
    try {
      const allMembers: Member[] = [];
      let cursor = options.after;
      const target = options.all
        ? Number.POSITIVE_INFINITY
        : Number(options.limit ?? "50");

      do {
        const remaining = target - allMembers.length;
        const perPage = Math.min(remaining, 200);

        const result = await graphqlRequest<{
          getMembers: {
            edges: { cursor: string; node: Member }[];
          };
        }>({
          query: `query($first: Int, $after: String, $order: OrderByInput) {
            getMembers(first: $first, after: $after, order: $order) {
              edges { cursor node { ${MEMBER_FIELDS} } }
            }
          }`,
          variables: { first: perPage, after: cursor, order: options.order },
        });

        const { edges } = result.getMembers;
        const members = edges.map((e) => e.node);
        allMembers.push(...members);

        if (allMembers.length < target && edges.length === perPage) {
          cursor = edges.at(-1)?.cursor;
          spinner.text = `Fetching members... (${allMembers.length} so far)`;
        } else {
          cursor = undefined;
        }
      } while (cursor);

      spinner.stop();

      const [first] = allMembers;
      if (first) {
        printMemberPreview(first);
      }

      if (allMembers.length > 0) {
        const outputPath = resolvePath(MEMBERS_OUTPUT_FILE);
        await writeFile(outputPath, `${JSON.stringify(allMembers, null, 2)}\n`);
        printSuccess(
          `Wrote ${allMembers.length} member(s) to ${MEMBERS_OUTPUT_FILE}`
        );
      } else {
        process.stderr.write(`\n  ${pc.dim("No members found.")}\n\n`);
      }
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("get")
  .description("Get a member by ID or email")
  .argument("<id_or_email>", "Member ID (mem_...) or email address")
  .action(async (idOrEmail: string) => {
    const spinner = yoctoSpinner({ text: "Fetching member..." }).start();
    try {
      if (idOrEmail.startsWith("mem_")) {
        const result = await graphqlRequest<{ currentMember: Member }>({
          query: `query($id: ID) { currentMember(id: $id) { ${MEMBER_FIELDS} } }`,
          variables: { id: idOrEmail },
        });
        spinner.stop();
        printRecord(result.currentMember);
      } else {
        const result = await graphqlRequest<{
          getMembers: { edges: { node: Member }[] };
        }>({
          query: `query($search: String) { getMembers(search: $search, first: 1) { edges { node { ${MEMBER_FIELDS} } } } }`,
          variables: { search: idOrEmail },
        });
        spinner.stop();
        const member = result.getMembers.edges[0]?.node;
        if (!member) {
          throw new Error(`Member not found: ${idOrEmail}`);
        }
        printRecord(member);
      }
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("create")
  .description("Create a new member")
  .requiredOption("--email <email>", "Member email address")
  .requiredOption("--password <password>", "Member password")
  .option("--plans <planId>", "Plan ID to connect (repeatable)", collect, [])
  .option(
    "--custom-fields <key=value>",
    "Custom field (repeatable)",
    collect,
    []
  )
  .option("--meta-data <key=value>", "Metadata field (repeatable)", collect, [])
  .option("--login-redirect <url>", "Login redirect URL")
  .action(async (options: MembersCreateOptions) => {
    const spinner = yoctoSpinner({ text: "Creating member..." }).start();
    try {
      const input: Record<string, unknown> = {
        email: options.email,
        password: options.password,
      };

      if (options.plans?.length) {
        input.plans = options.plans.map((planId) => ({ planId }));
      }
      if (options.customFields?.length) {
        input.customFields = parseKeyValuePairs(options.customFields);
      }
      if (options.metaData?.length) {
        input.metaData = parseKeyValuePairs(options.metaData);
      }
      if (options.loginRedirect) {
        input.loginRedirect = options.loginRedirect;
      }

      const result = await graphqlRequest<{
        signupMemberEmailPassword: { member: Member };
      }>({
        query: `mutation($input: SignupMemberEmailPasswordInput!) {
          signupMemberEmailPassword(input: $input) { member { ${MEMBER_FIELDS} } }
        }`,
        variables: { input },
      });
      spinner.stop();
      printSuccess(
        `Member created: ${result.signupMemberEmailPassword.member.id}`
      );
      printRecord(result.signupMemberEmailPassword.member);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("update")
  .description("Update a member")
  .argument("<id>", "Member ID (mem_...)")
  .option("--email <email>", "Update email address")
  .option(
    "--custom-fields <key=value>",
    "Custom field (repeatable)",
    collect,
    []
  )
  .option("--meta-data <key=value>", "Metadata field (repeatable)", collect, [])
  .option("--json <json>", "JSON data (as JSON string)")
  .option("--login-redirect <url>", "Login redirect URL")
  .action(async (id: string, options: MembersUpdateOptions) => {
    const spinner = yoctoSpinner({ text: "Updating member..." }).start();
    try {
      let member: Member | undefined;

      if (options.email) {
        const result = await graphqlRequest<{ updateMemberAuth: Member }>({
          query: `mutation($input: UpdateMemberAuthInput!) { updateMemberAuth(input: $input) { ${MEMBER_FIELDS} } }`,
          variables: { input: { memberId: id, email: options.email } },
        });
        member = result.updateMemberAuth;
      }

      const input: Record<string, unknown> = { memberId: id };
      if (options.customFields?.length) {
        input.customFields = parseKeyValuePairs(options.customFields);
      }
      if (options.metaData?.length) {
        input.metaData = parseKeyValuePairs(options.metaData);
      }
      if (options.json) {
        input.json = parseJsonString(options.json);
      }
      if (options.loginRedirect) {
        input.loginRedirect = options.loginRedirect;
      }

      if (Object.keys(input).length > 1) {
        const result = await graphqlRequest<{ updateMember: Member }>({
          query: `mutation($input: UpdateMemberInput!) { updateMember(input: $input) { ${MEMBER_FIELDS} } }`,
          variables: { input },
        });
        member = result.updateMember;
      }

      spinner.stop();
      if (member) {
        printSuccess(`Member updated: ${member.id}`);
        printRecord(member);
      }
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("delete")
  .description("Delete a member")
  .argument("<id>", "Member ID (mem_...)")
  .action(async (id: string) => {
    const spinner = yoctoSpinner({ text: "Deleting member..." }).start();
    try {
      const result = await graphqlRequest<{ deleteMember: string }>({
        query:
          "mutation($input: DeleteMemberInput!) { deleteMember(input: $input) }",
        variables: { input: { memberId: id } },
      });
      spinner.stop();
      printSuccess(`Member deleted: ${result.deleteMember}`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("add-plan")
  .description("Add a free plan to a member")
  .argument("<id>", "Member ID (mem_...)")
  .requiredOption("--plan-id <planId>", "Plan ID to add (pln_...)")
  .action(async (id: string, options: PlanOptions) => {
    const spinner = yoctoSpinner({ text: "Adding plan..." }).start();
    try {
      await graphqlRequest<{ addFreePlan: { id: string; name: string } }>({
        query:
          "mutation($input: AddFreePlanInput!) { addFreePlan(input: $input) { id name } }",
        variables: { input: { planId: options.planId, memberId: id } },
      });
      spinner.stop();
      printSuccess(`Plan ${options.planId} added to member ${id}`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("remove-plan")
  .description("Remove a free plan from a member")
  .argument("<id>", "Member ID (mem_...)")
  .requiredOption("--plan-id <planId>", "Plan ID to remove (pln_...)")
  .action(async (id: string, options: PlanOptions) => {
    const spinner = yoctoSpinner({ text: "Removing plan..." }).start();
    try {
      await graphqlRequest<{
        removeFreePlan: { id: string; name: string };
      }>({
        query:
          "mutation($input: RemoveFreePlanInput!) { removeFreePlan(input: $input) { id name } }",
        variables: { input: { planId: options.planId, memberId: id } },
      });
      spinner.stop();
      printSuccess(`Plan ${options.planId} removed from member ${id}`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("count")
  .description("Show total member count")
  .action(async () => {
    const spinner = yoctoSpinner({ text: "Counting members..." }).start();
    try {
      const result = await graphqlRequest<{ getMembersCount: number }>({
        query: "query { getMembersCount }",
      });
      spinner.stop();
      process.stderr.write(
        `\n  ${pc.bold("Total members:")} ${result.getMembersCount}\n\n`
      );
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("export")
  .description("Export all members to CSV or JSON")
  .option("--format <format>", "Output format (csv or json)", "json")
  .option("--output <path>", "Output file path")
  .action(async (options: MembersExportOptions) => {
    const spinner = yoctoSpinner({ text: "Fetching members..." }).start();
    try {
      const { members } = await fetchAllMembers(spinner);
      spinner.text = "Writing file...";

      const outputPath = resolvePath(
        options.output ?? `members.${options.format}`
      );
      const data = members.map((m) => flattenMember(m));
      await writeOutputFile(outputPath, data, options.format);

      spinner.stop();
      printSuccess(`Exported ${members.length} member(s) to ${outputPath}`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("import")
  .description("Import members from a CSV or JSON file")
  .requiredOption("--file <path>", "Input file path (CSV or JSON)")
  .action(async (options: MembersImportOptions) => {
    const spinner = yoctoSpinner({ text: "Reading file..." }).start();
    try {
      const rows = await readInputFile(options.file);
      let created = 0;
      let failed = 0;

      for (const [index, row] of rows.entries()) {
        spinner.text = `Importing member ${index + 1}/${rows.length}...`;

        if (!(row.email && row.password)) {
          printError(
            `Row ${index + 1}: Missing required field "email" or "password"`
          );
          failed++;
          continue;
        }

        const input = buildImportInput(row);

        try {
          await graphqlRequest<{
            signupMemberEmailPassword: { member: Member };
          }>({
            query: `mutation($input: SignupMemberEmailPasswordInput!) {
              signupMemberEmailPassword(input: $input) { member { ${MEMBER_FIELDS} } }
            }`,
            variables: { input },
          });
          created++;
        } catch (error) {
          printError(
            `Row ${index + 1} (${row.email}): ${error instanceof Error ? error.message : "Unknown error"}`
          );
          failed++;
        }

        if (index < rows.length - 1) {
          await delay(RATE_LIMIT_DELAY_MS);
        }
      }

      spinner.stop();
      printSuccess(`Import complete: ${created} created, ${failed} failed`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("find")
  .description("Find members by field values or plan")
  .option(
    "--field <key=value>",
    "Filter by custom field (repeatable)",
    collect,
    []
  )
  .option("--plan <planId>", "Filter by plan ID")
  .action(async (options: MembersFindOptions) => {
    const spinner = yoctoSpinner({ text: "Fetching members..." }).start();
    try {
      const hasFieldFilter = options.field && options.field.length > 0;
      const hasPlanFilter = !!options.plan;

      let members: Member[];

      if (hasPlanFilter && !hasFieldFilter) {
        const { members: fetched } = await fetchAllMembers(spinner, "ASC", {
          planIds: [options.plan],
        });
        members = fetched;
      } else {
        const { members: fetched } = await fetchAllMembers(spinner);
        members = fetched;

        if (hasPlanFilter) {
          members = members.filter((member) =>
            member.planConnections.some((conn) => conn.plan.id === options.plan)
          );
        }
      }

      if (hasFieldFilter) {
        const filters = parseKeyValuePairs(options.field as string[]);
        members = members.filter((member) => {
          const fields = { ...member.customFields, ...member.metaData };
          return Object.entries(filters).every(
            ([key, value]) => String(fields[key] ?? "") === value
          );
        });
      }

      spinner.stop();
      printSuccess(`Found ${members.length} member(s)`);
      printTable(members.map(flattenMember));
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("stats")
  .description("Show member statistics")
  .action(async () => {
    const spinner = yoctoSpinner({ text: "Fetching members..." }).start();
    try {
      const { members, totalCount } = await fetchAllMembers(spinner);
      spinner.stop();

      const planCounts: Record<string, number> = {};
      let active = 0;
      let inactive = 0;
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      let recentWeek = 0;
      let recentMonth = 0;

      for (const member of members) {
        const hasActive = member.planConnections.some(
          (conn) => conn.status === "ACTIVE"
        );
        if (hasActive) {
          active++;
        } else {
          inactive++;
        }

        for (const conn of member.planConnections) {
          planCounts[conn.plan.id] = (planCounts[conn.plan.id] ?? 0) + 1;
        }

        const created = new Date(member.createdAt).getTime();
        if (created >= sevenDaysAgo) {
          recentWeek++;
        }
        if (created >= thirtyDaysAgo) {
          recentMonth++;
        }
      }

      process.stderr.write("\n");
      process.stderr.write(
        `  ${pc.bold("Total members:")}     ${totalCount}\n`
      );
      process.stderr.write(`  ${pc.bold("Active:")}            ${active}\n`);
      process.stderr.write(`  ${pc.bold("Inactive:")}          ${inactive}\n`);
      process.stderr.write(
        `  ${pc.bold("Signups (7d):")}      ${recentWeek}\n`
      );
      process.stderr.write(
        `  ${pc.bold("Signups (30d):")}     ${recentMonth}\n`
      );

      if (Object.keys(planCounts).length > 0) {
        process.stderr.write(`\n  ${pc.bold("Members by plan:")}\n`);
        for (const [planId, count] of Object.entries(planCounts)) {
          process.stderr.write(`    ${planId}: ${count}\n`);
        }
      }

      process.stderr.write("\n");
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("bulk-update")
  .description("Bulk update members from a CSV or JSON file")
  .requiredOption("--file <path>", "Input file with member updates")
  .option("--dry-run", "Preview changes without applying them")
  .action(async (options: MembersBulkUpdateOptions) => {
    const spinner = yoctoSpinner({ text: "Reading file..." }).start();
    try {
      const rows = await readInputFile(options.file);
      let updated = 0;
      let failed = 0;

      for (const [index, row] of rows.entries()) {
        if (!row.id) {
          printError(`Row ${index + 1}: Missing required "id" field`);
          failed++;
          continue;
        }

        if (options.dryRun) {
          const input = buildUpdateInput(row, row.id);
          process.stderr.write(
            `  ${pc.dim(`[dry-run] Would update ${row.id}:`)} ${JSON.stringify(input)}\n`
          );
          updated++;
          continue;
        }

        spinner.text = `Updating member ${index + 1}/${rows.length}...`;

        try {
          if (row.email) {
            await graphqlRequest<{ updateMemberAuth: Member }>({
              query: `mutation($input: UpdateMemberAuthInput!) { updateMemberAuth(input: $input) { ${MEMBER_FIELDS} } }`,
              variables: {
                input: { memberId: row.id, email: row.email },
              },
            });
          }

          const input = buildUpdateInput(row, row.id);
          if (Object.keys(input).length > 1) {
            await graphqlRequest<{ updateMember: Member }>({
              query: `mutation($input: UpdateMemberInput!) { updateMember(input: $input) { ${MEMBER_FIELDS} } }`,
              variables: { input },
            });
          }

          updated++;
        } catch (error) {
          printError(
            `Row ${index + 1} (${row.id}): ${error instanceof Error ? error.message : "Unknown error"}`
          );
          failed++;
        }

        if (index < rows.length - 1) {
          await delay(RATE_LIMIT_DELAY_MS);
        }
      }

      spinner.stop();
      const prefix = options.dryRun ? "[dry-run] " : "";
      printSuccess(
        `${prefix}Bulk update complete: ${updated} updated, ${failed} failed`
      );
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

membersCommand
  .command("bulk-add-plan")
  .description("Add a plan to multiple members")
  .requiredOption("--plan <planId>", "Plan ID to add (pln_...)")
  .requiredOption("--filter <filter>", "Member filter: no-plan or all")
  .option("--dry-run", "Preview without applying changes")
  .action(async (options: MembersBulkAddPlanOptions) => {
    const spinner = yoctoSpinner({ text: "Fetching members..." }).start();
    try {
      const { members } = await fetchAllMembers(spinner);

      let targets: Member[];
      if (options.filter === "no-plan") {
        targets = members.filter((m) => m.planConnections.length === 0);
      } else if (options.filter === "all") {
        targets = members;
      } else {
        spinner.stop();
        printError(
          `Unknown filter "${options.filter}". Use "no-plan" or "all".`
        );
        process.exitCode = 1;
        return;
      }

      let added = 0;
      let failed = 0;

      for (const [index, member] of targets.entries()) {
        if (options.dryRun) {
          process.stderr.write(
            `  ${pc.dim(`[dry-run] Would add plan ${options.plan} to ${member.id} (${member.auth.email})`)}\n`
          );
          added++;
          continue;
        }

        spinner.text = `Adding plan ${index + 1}/${targets.length}...`;

        try {
          await graphqlRequest<{
            addFreePlan: { id: string; name: string };
          }>({
            query:
              "mutation($input: AddFreePlanInput!) { addFreePlan(input: $input) { id name } }",
            variables: {
              input: { planId: options.plan, memberId: member.id },
            },
          });
          added++;
        } catch (error) {
          printError(
            `${member.id} (${member.auth.email}): ${error instanceof Error ? error.message : "Unknown error"}`
          );
          failed++;
        }

        if (index < targets.length - 1) {
          await delay(RATE_LIMIT_DELAY_MS);
        }
      }

      spinner.stop();
      const prefix = options.dryRun ? "[dry-run] " : "";
      printSuccess(
        `${prefix}Bulk add-plan complete: ${added} added, ${failed} failed (${targets.length} targeted)`
      );
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
