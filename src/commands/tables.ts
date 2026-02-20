import { Command } from "commander";
import pc from "picocolors";
import yoctoSpinner from "yocto-spinner";
import { graphqlRequest } from "../lib/graphql-client.js";
import {
  printError,
  printRecord,
  printSuccess,
  printTable,
} from "../lib/utils.js";

interface TableField {
  defaultValue: unknown;
  id: string;
  key: string;
  name: string;
  referencedTable?: { id: string; key: string; name: string };
  referencedTableId: string | null;
  required: boolean;
  tableOrder: number;
  type: string;
}

interface DataTable {
  createdAt: string;
  createRule: string;
  deleteRule: string;
  fields: TableField[];
  id: string;
  key: string;
  name: string;
  readRule: string;
  updatedAt: string;
  updateRule: string;
}

const TABLE_FIELDS = `
  id
  key
  name
  createdAt
  updatedAt
  createRule
  readRule
  updateRule
  deleteRule
  fields {
    id
    key
    name
    type
    required
    defaultValue
    tableOrder
    referencedTableId
    referencedTable {
      id
      key
      name
    }
  }
`;

export const tablesCommand = new Command("tables")
  .usage("<command> [options]")
  .description("Manage data tables");

tablesCommand
  .command("list")
  .description("List all data tables")
  .action(async () => {
    const spinner = yoctoSpinner({ text: "Fetching tables..." }).start();
    try {
      const result = await graphqlRequest<{ dataTables: DataTable[] }>({
        query: `query { dataTables { ${TABLE_FIELDS} } }`,
      });
      spinner.stop();
      const rows = result.dataTables.map((t) => ({
        id: t.id,
        key: t.key,
        name: t.name,
        createdAt: t.createdAt,
        createRule: t.createRule,
        readRule: t.readRule,
        updateRule: t.updateRule,
        deleteRule: t.deleteRule,
      }));
      printTable(rows);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

tablesCommand
  .command("get")
  .description("Get a data table by key or ID")
  .argument("<table_key>", "Table key or ID")
  .action(async (tableKey: string) => {
    const spinner = yoctoSpinner({ text: "Fetching table..." }).start();
    try {
      const result = await graphqlRequest<{ dataTable: DataTable }>({
        query: `query($key: String!) { dataTable(key: $key) { ${TABLE_FIELDS} } }`,
        variables: { key: tableKey },
      });
      spinner.stop();
      printRecord(result.dataTable);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

tablesCommand
  .command("describe")
  .description("Show table schema details")
  .argument("<table_key>", "Table key or ID")
  .action(async (tableKey: string) => {
    const spinner = yoctoSpinner({ text: "Fetching table..." }).start();
    try {
      const result = await graphqlRequest<{ dataTable: DataTable }>({
        query: `query($key: String!) { dataTable(key: $key) { ${TABLE_FIELDS} } }`,
        variables: { key: tableKey },
      });
      spinner.stop();

      const table = result.dataTable;
      process.stderr.write("\n");
      process.stderr.write(
        `  ${pc.bold("Table:")}  ${table.name} (${table.key})\n`
      );
      process.stderr.write(`  ${pc.bold("ID:")}     ${table.id}\n`);
      process.stderr.write("\n");
      process.stderr.write(`  ${pc.bold("Access Rules:")}\n`);
      process.stderr.write(`    Create: ${table.createRule}\n`);
      process.stderr.write(`    Read:   ${table.readRule}\n`);
      process.stderr.write(`    Update: ${table.updateRule}\n`);
      process.stderr.write(`    Delete: ${table.deleteRule}\n`);
      process.stderr.write("\n");

      if (table.fields.length > 0) {
        process.stderr.write(`  ${pc.bold("Fields:")}\n`);
        for (const field of table.fields) {
          const required = field.required ? pc.red("*") : " ";
          const ref = field.referencedTable
            ? pc.dim(
                ` → ${field.referencedTable.name} (${field.referencedTable.key})`
              )
            : "";
          process.stderr.write(
            `    ${required} ${pc.cyan(field.key)} ${pc.dim(field.type)}${ref}\n`
          );
        }
      } else {
        process.stderr.write(`  ${pc.dim("No fields defined")}\n`);
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

const ACCESS_RULE_DESC =
  "Access rule (PUBLIC, AUTHENTICATED, AUTHENTICATED_OWN, ADMIN_ONLY)";

tablesCommand
  .command("create")
  .description("Create a new data table")
  .requiredOption("--name <name>", "Table name")
  .requiredOption("--key <key>", "Table key (unique identifier)")
  .option("--create-rule <rule>", ACCESS_RULE_DESC)
  .option("--read-rule <rule>", ACCESS_RULE_DESC)
  .option("--update-rule <rule>", ACCESS_RULE_DESC)
  .option("--delete-rule <rule>", ACCESS_RULE_DESC)
  .action(async (opts) => {
    const spinner = yoctoSpinner({ text: "Creating table..." }).start();
    try {
      const input: Record<string, unknown> = {
        name: opts.name,
        key: opts.key,
      };
      if (opts.createRule !== undefined) {
        input.createRule = opts.createRule;
      }
      if (opts.readRule !== undefined) {
        input.readRule = opts.readRule;
      }
      if (opts.updateRule !== undefined) {
        input.updateRule = opts.updateRule;
      }
      if (opts.deleteRule !== undefined) {
        input.deleteRule = opts.deleteRule;
      }

      const result = await graphqlRequest<{ createDataTable: DataTable }>({
        query: `mutation($input: CreateDataTableInput!) {
  createDataTable(input: $input) {
    ${TABLE_FIELDS}
  }
}`,
        variables: { input },
      });
      spinner.stop();
      printSuccess("Table created successfully.");
      printRecord(result.createDataTable);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

tablesCommand
  .command("update")
  .description("Update a data table")
  .argument("<id>", "Table ID")
  .option("--name <name>", "Table name")
  .option("--create-rule <rule>", ACCESS_RULE_DESC)
  .option("--read-rule <rule>", ACCESS_RULE_DESC)
  .option("--update-rule <rule>", ACCESS_RULE_DESC)
  .option("--delete-rule <rule>", ACCESS_RULE_DESC)
  .action(async (id: string, opts) => {
    const spinner = yoctoSpinner({ text: "Updating table..." }).start();
    try {
      const input: Record<string, unknown> = { id };

      if (opts.name !== undefined) {
        input.name = opts.name;
      }
      if (opts.createRule !== undefined) {
        input.createRule = opts.createRule;
      }
      if (opts.readRule !== undefined) {
        input.readRule = opts.readRule;
      }
      if (opts.updateRule !== undefined) {
        input.updateRule = opts.updateRule;
      }
      if (opts.deleteRule !== undefined) {
        input.deleteRule = opts.deleteRule;
      }

      if (Object.keys(input).length === 1) {
        spinner.stop();
        printError(
          "No update options provided. Use --help to see available options."
        );
        process.exitCode = 1;
        return;
      }

      const result = await graphqlRequest<{ updateDataTable: DataTable }>({
        query: `mutation($input: UpdateDataTableInput!) {
  updateDataTable(input: $input) {
    ${TABLE_FIELDS}
  }
}`,
        variables: { input },
      });
      spinner.stop();
      printSuccess("Table updated successfully.");
      printRecord(result.updateDataTable);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

tablesCommand
  .command("delete")
  .description("Delete a data table")
  .argument("<id>", "Table ID")
  .action(async (id: string) => {
    const spinner = yoctoSpinner({ text: "Deleting table..." }).start();
    try {
      await graphqlRequest<{ deleteDataTable: string }>({
        query: `mutation($input: DeleteDataTableInput!) {
  deleteDataTable(input: $input)
}`,
        variables: { input: { id } },
      });
      spinner.stop();
      printSuccess(`Table "${id}" deleted.`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
