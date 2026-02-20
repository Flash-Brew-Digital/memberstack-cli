import Table from "cli-table3";
import pc from "picocolors";
import { program } from "./program.js";

const plainStyle = { head: [], border: [] };
const tableOptions = pc.isColorSupported ? {} : { style: plainStyle };

export const printJson = (data: unknown): void => {
  const json = JSON.stringify(data, null, 2);
  process.stdout.write(`${json}\n`);
};

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return `${value.length} items`;
  }
  if (typeof value === "object") {
    const str = JSON.stringify(value);
    return str.length > 50 ? `${str.slice(0, 47)}...` : str;
  }
  return String(value);
};

export const printTable = (rows: object[]): void => {
  if (program.opts().json) {
    printJson(rows);
    return;
  }
  if (rows.length === 0) {
    process.stderr.write("No data to display.\n");
    return;
  }
  const entries = rows as Record<string, unknown>[];
  const headers = [...new Set(entries.flatMap(Object.keys))];
  const table = new Table({
    ...tableOptions,
    head: headers.map((h) => pc.cyan(h)),
  });
  for (const row of entries) {
    table.push(headers.map((h) => formatCellValue(row[h])));
  }
  process.stderr.write(`${table.toString()}\n`);
};

export const printRecord = (obj: object): void => {
  if (program.opts().json) {
    printJson(obj);
    return;
  }
  const table = new Table(tableOptions);
  for (const [key, value] of Object.entries(obj)) {
    table.push({ [pc.cyan(key)]: formatCellValue(value) });
  }
  process.stderr.write(`${table.toString()}\n`);
};

export const printError = (message: string): void => {
  process.stderr.write(`${pc.red(message)}\n`);
};

export const printSuccess = (message: string): void => {
  if (program.opts().quiet) {
    return;
  }
  process.stderr.write(`${pc.green(message)}\n`);
};

export const parseKeyValuePairs = (pairs: string[]): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const pair of pairs) {
    const index = pair.indexOf("=");
    if (index === -1) {
      throw new Error(
        `Invalid key=value pair: "${pair}". Expected format: key=value`
      );
    }
    const key = pair.slice(0, index);
    const value = pair.slice(index + 1);
    result[key] = value;
  }
  return result;
};

export const parseJsonString = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(
      `Invalid JSON string: "${value}". Ensure it is valid JSON.`
    );
  }
};

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const WHERE_OPERATORS = new Set([
  "equals",
  "not",
  "in",
  "notIn",
  "lt",
  "lte",
  "gt",
  "gte",
  "contains",
  "startsWith",
  "endsWith",
]);

const coerceValue = (value: string): unknown => {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value === "null") {
    return null;
  }
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== "") {
    return num;
  }
  return value;
};

export const parseWhereClause = (
  clauses: string[]
): Record<string, Record<string, unknown>> => {
  const where: Record<string, Record<string, unknown>> = {};
  for (const clause of clauses) {
    const parts = clause.split(" ");
    if (parts.length < 3) {
      throw new Error(
        `Invalid where clause: "${clause}". Expected format: "field operator value"`
      );
    }
    const [field, operator, ...valueParts] = parts;
    const value = valueParts.join(" ");
    if (!WHERE_OPERATORS.has(operator)) {
      throw new Error(
        `Unknown operator "${operator}" in where clause. Valid: ${[...WHERE_OPERATORS].join(", ")}`
      );
    }
    where[field] = { [operator]: coerceValue(value) };
  }
  return where;
};
