import { resolve } from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import yoctoSpinner from "yocto-spinner";
import { RATE_LIMIT_DELAY_MS } from "../lib/constants.js";
import { readInputFile, writeOutputFile } from "../lib/csv.js";
import { graphqlRequest } from "../lib/graphql-client.js";
import type {
  DataRecord,
  RecordDataOptions,
  RecordQueryOptions,
  RecordsBulkDeleteOptions,
  RecordsBulkUpdateOptions,
  RecordsExportOptions,
  RecordsFindOptions,
  RecordsImportOptions,
} from "../lib/types.js";
import {
  delay,
  parseJsonString,
  parseKeyValuePairs,
  parseWhereClause,
  printError,
  printJson,
  printRecord,
  printSuccess,
  printTable,
} from "../lib/utils.js";

const collect = (value: string, previous: string[]): string[] => [
  ...previous,
  value,
];

const SKIP_COLUMNS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "tableKey",
  "internalOrder",
]);

const DATA_RECORD_FIELDS = `
  id
  tableKey
  data
  createdAt
  updatedAt
  internalOrder
`;

const extractDataFields = (
  row: Record<string, string>
): Record<string, string> => {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (SKIP_COLUMNS.has(key) || value === "") {
      continue;
    }
    // Strip "data." prefix if present (from export format)
    const fieldKey = key.startsWith("data.") ? key.slice(5) : key;
    data[fieldKey] = value;
  }
  return data;
};

const resolveTableId = async (tableKey: string): Promise<string> => {
  const result = await graphqlRequest<{ dataTable: { id: string } }>({
    query: "query($key: String!) { dataTable(key: $key) { id } }",
    variables: { key: tableKey },
  });
  return result.dataTable.id;
};

export const recordsCommand = new Command("records")
  .usage("<command> [options]")
  .description("Manage data table records");

recordsCommand
  .command("create")
  .description("Create a new record in a data table")
  .argument("<table_key>", "Table key or ID")
  .requiredOption(
    "--data <key=value>",
    "Record field data (repeatable)",
    collect,
    []
  )
  .action(async (tableKey: string, options: RecordDataOptions) => {
    const spinner = yoctoSpinner({ text: "Creating record..." }).start();
    try {
      const tableId = await resolveTableId(tableKey);
      const data = parseKeyValuePairs(options.data);
      const result = await graphqlRequest<{ createDataRecord: DataRecord }>({
        query: `mutation($input: CreateDataRecordInput!) {
  createDataRecord(input: $input) { ${DATA_RECORD_FIELDS} }
}`,
        variables: { input: { tableId, data } },
      });
      spinner.stop();
      printSuccess(`Record created: ${result.createDataRecord.id}`);
      printRecord(result.createDataRecord);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

recordsCommand
  .command("update")
  .description("Update a record in a data table")
  .argument("<table_key>", "Table key or ID")
  .argument("<record_id>", "Record ID")
  .requiredOption(
    "--data <key=value>",
    "Record field data (repeatable)",
    collect,
    []
  )
  .action(
    async (_tableKey: string, recordId: string, options: RecordDataOptions) => {
      const spinner = yoctoSpinner({ text: "Updating record..." }).start();
      try {
        const data = parseKeyValuePairs(options.data);
        const result = await graphqlRequest<{ updateDataRecord: DataRecord }>({
          query: `mutation($input: UpdateDataRecordInput!) {
  updateDataRecord(input: $input) { ${DATA_RECORD_FIELDS} }
}`,
          variables: { input: { id: recordId, data } },
        });
        spinner.stop();
        printSuccess(`Record updated: ${result.updateDataRecord.id}`);
        printRecord(result.updateDataRecord);
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "An unknown error occurred"
        );
        process.exitCode = 1;
      }
    }
  );

recordsCommand
  .command("delete")
  .description("Delete a record from a data table")
  .argument("<table_key>", "Table key or ID")
  .argument("<record_id>", "Record ID")
  .action(async (_tableKey: string, recordId: string) => {
    const spinner = yoctoSpinner({ text: "Deleting record..." }).start();
    try {
      const result = await graphqlRequest<{ deleteDataRecord: string }>({
        query:
          "mutation($input: DeleteDataRecordInput!) { deleteDataRecord(input: $input) }",
        variables: { input: { id: recordId } },
      });
      spinner.stop();
      printSuccess(`Record deleted: ${result.deleteDataRecord}`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

recordsCommand
  .command("query")
  .description("Query records in a data table")
  .argument("<table_key>", "Table key or ID")
  .requiredOption("--query <json>", "Query body as JSON string")
  .action(async (tableKey: string, options: RecordQueryOptions) => {
    const spinner = yoctoSpinner({ text: "Querying records..." }).start();
    try {
      const tableId = await resolveTableId(tableKey);
      const parsed = parseJsonString(options.query) as Record<string, unknown>;
      const result = await graphqlRequest<{
        dataRecords: {
          edges: { node: DataRecord }[];
          totalCount: number;
        };
      }>({
        query: `query($tableId: ID!, $filter: DataRecordsFilterInput, $pagination: DataRecordsPaginationInput) {
  dataRecords(tableId: $tableId, filter: $filter, pagination: $pagination) {
    edges { node { ${DATA_RECORD_FIELDS} } }
    totalCount
  }
}`,
        variables: { tableId, ...parsed },
      });
      spinner.stop();
      printJson(result.dataRecords);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

recordsCommand
  .command("count")
  .description("Count records in a data table")
  .argument("<table_key>", "Table key or ID")
  .action(async (tableKey: string) => {
    const spinner = yoctoSpinner({ text: "Counting records..." }).start();
    try {
      const result = await graphqlRequest<{
        dataTable: { recordCount: number };
      }>({
        query: "query($key: String!) { dataTable(key: $key) { recordCount } }",
        variables: { key: tableKey },
      });
      spinner.stop();
      process.stderr.write(
        `\n  ${pc.bold("Total records:")} ${result.dataTable.recordCount}\n\n`
      );
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

recordsCommand
  .command("find")
  .description("Find records with friendly filter syntax")
  .argument("<table_key>", "Table key or ID")
  .option(
    "--where <clause>",
    'Filter clause: "field operator value" (repeatable)',
    collect,
    []
  )
  .option("--take <n>", "Limit results")
  .action(async (tableKey: string, options: RecordsFindOptions) => {
    const spinner = yoctoSpinner({ text: "Querying records..." }).start();
    try {
      const tableId = await resolveTableId(tableKey);
      const variables: Record<string, unknown> = { tableId };

      if (options.where?.length) {
        variables.filter = { fieldFilters: parseWhereClause(options.where) };
      }
      if (options.take) {
        variables.pagination = { first: Number(options.take) };
      }

      const result = await graphqlRequest<{
        dataRecords: {
          edges: { node: DataRecord }[];
          totalCount: number;
        };
      }>({
        query: `query($tableId: ID!, $filter: DataRecordsFilterInput, $pagination: DataRecordsPaginationInput) {
  dataRecords(tableId: $tableId, filter: $filter, pagination: $pagination) {
    edges { node { ${DATA_RECORD_FIELDS} } }
    totalCount
  }
}`,
        variables,
      });
      spinner.stop();
      const records = result.dataRecords.edges.map((e) => ({
        id: e.node.id,
        createdAt: e.node.createdAt,
        updatedAt: e.node.updatedAt,
        ...Object.fromEntries(
          Object.entries(e.node.data).map(([k, v]) => [`data.${k}`, v])
        ),
      }));
      printSuccess(`Found ${records.length} record(s)`);
      printTable(records);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

recordsCommand
  .command("export")
  .description("Export all records from a data table")
  .argument("<table_key>", "Table key or ID")
  .option("--format <format>", "Output format (csv or json)", "json")
  .option("--output <path>", "Output file path")
  .action(async (tableKey: string, options: RecordsExportOptions) => {
    const spinner = yoctoSpinner({ text: "Fetching records..." }).start();
    try {
      const tableId = await resolveTableId(tableKey);
      const allRecords: Record<string, unknown>[] = [];
      let cursor: string | undefined;

      do {
        const pageSize = 100;
        const result = await graphqlRequest<{
          dataRecords: {
            edges: { cursor: string; node: DataRecord }[];
          };
        }>({
          query: `query($tableId: ID!, $pagination: DataRecordsPaginationInput) {
  dataRecords(tableId: $tableId, pagination: $pagination) {
    edges { cursor node { ${DATA_RECORD_FIELDS} } }
  }
}`,
          variables: {
            tableId,
            pagination: { first: pageSize, after: cursor },
          },
        });

        const { edges } = result.dataRecords;

        for (const { node: record } of edges) {
          allRecords.push({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            ...Object.fromEntries(
              Object.entries(record.data).map(([k, v]) => [`data.${k}`, v])
            ),
          });
        }

        if (edges.length === pageSize) {
          cursor = edges.at(-1)?.cursor;
          spinner.text = `Fetching records... (${allRecords.length} so far)`;
        } else {
          cursor = undefined;
        }
      } while (cursor !== undefined);

      spinner.text = "Writing file...";

      const outputPath = resolve(
        options.output ?? `records-${tableKey}.${options.format}`
      );
      await writeOutputFile(outputPath, allRecords, options.format);

      spinner.stop();
      printSuccess(`Exported ${allRecords.length} record(s) to ${outputPath}`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

recordsCommand
  .command("import")
  .description("Import records into a data table from a file")
  .argument("<table_key>", "Table key or ID")
  .requiredOption("--file <path>", "Input file path (CSV or JSON)")
  .action(async (tableKey: string, options: RecordsImportOptions) => {
    const spinner = yoctoSpinner({ text: "Reading file..." }).start();
    try {
      const tableId = await resolveTableId(tableKey);
      const rows = await readInputFile(options.file);
      let created = 0;
      let failed = 0;

      for (const [index, row] of rows.entries()) {
        spinner.text = `Creating record ${index + 1}/${rows.length}...`;
        const data = extractDataFields(row);

        if (Object.keys(data).length === 0) {
          printError(`Row ${index + 1}: No data fields found`);
          failed++;
          continue;
        }

        try {
          await graphqlRequest<{ createDataRecord: DataRecord }>({
            query:
              "mutation($input: CreateDataRecordInput!) { createDataRecord(input: $input) { id } }",
            variables: { input: { tableId, data } },
          });
          created++;
        } catch (error) {
          printError(
            `Row ${index + 1}: ${error instanceof Error ? error.message : "Unknown error"}`
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

recordsCommand
  .command("bulk-update")
  .description("Bulk update records from a CSV or JSON file")
  .requiredOption(
    "--file <path>",
    "Input file with record updates (rows must include an id field)"
  )
  .option("--dry-run", "Preview changes without applying them")
  .action(async (options: RecordsBulkUpdateOptions) => {
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

        const data = extractDataFields(row);

        if (options.dryRun) {
          process.stderr.write(
            `  ${pc.dim(`[dry-run] Would update ${row.id}:`)} ${JSON.stringify(data)}\n`
          );
          updated++;
          continue;
        }

        spinner.text = `Updating record ${index + 1}/${rows.length}...`;

        try {
          await graphqlRequest<{ updateDataRecord: DataRecord }>({
            query:
              "mutation($input: UpdateDataRecordInput!) { updateDataRecord(input: $input) { id } }",
            variables: { input: { id: row.id, data } },
          });
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

recordsCommand
  .command("bulk-delete")
  .description("Bulk delete records matching a filter")
  .argument("<table_key>", "Table key or ID")
  .option(
    "--where <clause>",
    'Filter clause: "field operator value" (repeatable)',
    collect,
    []
  )
  .option("--dry-run", "Preview deletions without applying them")
  .action(async (tableKey: string, options: RecordsBulkDeleteOptions) => {
    const spinner = yoctoSpinner({ text: "Querying records..." }).start();
    try {
      const tableId = await resolveTableId(tableKey);
      const variables: Record<string, unknown> = {
        tableId,
        pagination: { first: 100 },
      };

      if (options.where?.length) {
        variables.filter = { fieldFilters: parseWhereClause(options.where) };
      }

      const result = await graphqlRequest<{
        dataRecords: {
          edges: { node: DataRecord }[];
        };
      }>({
        query: `query($tableId: ID!, $filter: DataRecordsFilterInput, $pagination: DataRecordsPaginationInput) {
  dataRecords(tableId: $tableId, filter: $filter, pagination: $pagination) {
    edges { node { ${DATA_RECORD_FIELDS} } }
  }
}`,
        variables,
      });

      const targets = result.dataRecords.edges.map((e) => e.node);

      if (targets.length === 0) {
        spinner.stop();
        printSuccess("No matching records found");
        return;
      }

      let deleted = 0;
      let failed = 0;

      for (const [index, record] of targets.entries()) {
        if (options.dryRun) {
          process.stderr.write(
            `  ${pc.dim(`[dry-run] Would delete ${record.id}`)}\n`
          );
          deleted++;
          continue;
        }

        spinner.text = `Deleting record ${index + 1}/${targets.length}...`;

        try {
          await graphqlRequest<{ deleteDataRecord: string }>({
            query:
              "mutation($input: DeleteDataRecordInput!) { deleteDataRecord(input: $input) }",
            variables: { input: { id: record.id } },
          });
          deleted++;
        } catch (error) {
          printError(
            `${record.id}: ${error instanceof Error ? error.message : "Unknown error"}`
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
        `${prefix}Bulk delete complete: ${deleted} deleted, ${failed} failed`
      );
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
