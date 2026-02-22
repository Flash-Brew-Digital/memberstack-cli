import { Command } from "commander";
import yoctoSpinner from "yocto-spinner";
import { graphqlRequest } from "../lib/graphql-client.js";
import {
  printError,
  printRecord,
  printSuccess,
  printTable,
} from "../lib/utils.js";

interface Permission {
  description: string | null;
  id: string;
  name: string;
}

const PERMISSION_FIELDS = `
  id
  name
  description
`;

const collect = (value: string, previous: string[]): string[] => [
  ...previous,
  value,
];

export const permissionsCommand = new Command("permissions")
  .usage("<command> [options]")
  .description("Manage permissions");

permissionsCommand
  .command("list")
  .description("List all permissions")
  .action(async () => {
    const spinner = yoctoSpinner({ text: "Fetching permissions..." }).start();
    try {
      const result = await graphqlRequest<{
        getPermissions: Permission[];
      }>({
        query: `query { getPermissions { ${PERMISSION_FIELDS} } }`,
      });
      spinner.stop();
      printTable(result.getPermissions);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

permissionsCommand
  .command("create")
  .description("Create a permission")
  .requiredOption("--name <name>", "Permission name")
  .option("--description <desc>", "Permission description")
  .action(async (opts: { name: string; description?: string }) => {
    const spinner = yoctoSpinner({ text: "Creating permission..." }).start();
    try {
      const input: Record<string, string> = { name: opts.name };
      if (opts.description) {
        input.description = opts.description;
      }
      const result = await graphqlRequest<{
        createPermission: Permission;
      }>({
        query: `mutation($input: CreatePermissionInput!) {
  createPermission(input: $input) {
    ${PERMISSION_FIELDS}
  }
}`,
        variables: { input },
      });
      spinner.stop();
      printSuccess("Permission created successfully.");
      printRecord(result.createPermission);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

permissionsCommand
  .command("update")
  .description("Update a permission")
  .argument("<permissionId>", "Permission ID to update")
  .option("--name <name>", "Permission name")
  .option("--description <desc>", "Permission description")
  .action(
    async (
      permissionId: string,
      opts: { name?: string; description?: string }
    ) => {
      const input: Record<string, string> = { permissionId };
      if (opts.name) {
        input.name = opts.name;
      }
      if (opts.description) {
        input.description = opts.description;
      }

      if (Object.keys(input).length <= 1) {
        printError(
          "No update options provided. Use --help to see available options."
        );
        process.exitCode = 1;
        return;
      }

      const spinner = yoctoSpinner({ text: "Updating permission..." }).start();
      try {
        const result = await graphqlRequest<{
          updatePermission: Permission;
        }>({
          query: `mutation($input: UpdatePermissionInput!) {
  updatePermission(input: $input) {
    ${PERMISSION_FIELDS}
  }
}`,
          variables: { input },
        });
        spinner.stop();
        printSuccess("Permission updated successfully.");
        printRecord(result.updatePermission);
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "An unknown error occurred"
        );
        process.exitCode = 1;
      }
    }
  );

permissionsCommand
  .command("delete")
  .description("Delete a permission")
  .argument("<permissionId>", "Permission ID to delete")
  .action(async (permissionId: string) => {
    const spinner = yoctoSpinner({ text: "Deleting permission..." }).start();
    try {
      const result = await graphqlRequest<{
        deletePermission: Permission;
      }>({
        query: `mutation($input: DeletePermissionInput!) {
  deletePermission(input: $input) {
    ${PERMISSION_FIELDS}
  }
}`,
        variables: { input: { permissionId } },
      });
      spinner.stop();
      printSuccess(`Permission "${result.deletePermission.name}" deleted.`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

permissionsCommand
  .command("link-plan")
  .description("Link permissions to a plan")
  .requiredOption("--plan-id <id>", "Plan ID")
  .requiredOption(
    "--permission-id <id>",
    "Permission ID (repeatable)",
    collect,
    []
  )
  .action(async (opts: { planId: string; permissionId: string[] }) => {
    const spinner = yoctoSpinner({
      text: "Linking permissions to plan...",
    }).start();
    try {
      await graphqlRequest({
        query: `mutation($input: LinkPermissionsToPlanInput!) {
  linkPermissionsToPlan(input: $input) { id name }
}`,
        variables: {
          input: { planId: opts.planId, permissionIds: opts.permissionId },
        },
      });
      spinner.stop();
      printSuccess(
        `Linked ${opts.permissionId.length} permission(s) to plan ${opts.planId}.`
      );
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

permissionsCommand
  .command("unlink-plan")
  .description("Unlink a permission from a plan")
  .requiredOption("--plan-id <id>", "Plan ID")
  .requiredOption("--permission-id <id>", "Permission ID")
  .action(async (opts: { planId: string; permissionId: string }) => {
    const spinner = yoctoSpinner({
      text: "Unlinking permission from plan...",
    }).start();
    try {
      await graphqlRequest({
        query: `mutation($input: DetachPermissionFromPlanInput!) {
  detachPermissionFromPlan(input: $input) { id name }
}`,
        variables: {
          input: { planId: opts.planId, permissionId: opts.permissionId },
        },
      });
      spinner.stop();
      printSuccess(
        `Unlinked permission ${opts.permissionId} from plan ${opts.planId}.`
      );
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

permissionsCommand
  .command("link-member")
  .description("Link permissions to a member")
  .requiredOption("--member-id <id>", "Member ID")
  .requiredOption(
    "--permission-id <id>",
    "Permission ID (repeatable)",
    collect,
    []
  )
  .action(async (opts: { memberId: string; permissionId: string[] }) => {
    const spinner = yoctoSpinner({
      text: "Linking permissions to member...",
    }).start();
    try {
      await graphqlRequest({
        query: `mutation($input: LinkPermissionsToMemberInput!) {
  linkPermissionsToMember(input: $input) { id }
}`,
        variables: {
          input: { memberId: opts.memberId, permissionIds: opts.permissionId },
        },
      });
      spinner.stop();
      printSuccess(
        `Linked ${opts.permissionId.length} permission(s) to member ${opts.memberId}.`
      );
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

permissionsCommand
  .command("unlink-member")
  .description("Unlink a permission from a member")
  .requiredOption("--member-id <id>", "Member ID")
  .requiredOption("--permission-id <id>", "Permission ID")
  .action(async (opts: { memberId: string; permissionId: string }) => {
    const spinner = yoctoSpinner({
      text: "Unlinking permission from member...",
    }).start();
    try {
      await graphqlRequest({
        query: `mutation($input: DetachPermissionFromMemberInput!) {
  detachPermissionFromMember(input: $input) { id }
}`,
        variables: {
          input: { memberId: opts.memberId, permissionId: opts.permissionId },
        },
      });
      spinner.stop();
      printSuccess(
        `Unlinked permission ${opts.permissionId} from member ${opts.memberId}.`
      );
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
