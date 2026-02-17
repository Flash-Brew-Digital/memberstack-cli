import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import Papa from "papaparse";

export const readCsvFile = async (
  filePath: string
): Promise<Record<string, string>[]> => {
  const content = await readFile(filePath, "utf-8");
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  });
  if (result.errors.length > 0) {
    throw new Error(`CSV parse error: ${result.errors[0].message}`);
  }
  return result.data;
};

export const readInputFile = async (
  filePath: string
): Promise<Record<string, string>[]> => {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".json") {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Record<string, string>[];
  }
  return readCsvFile(filePath);
};

export const flattenObject = (
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenObject(value as Record<string, unknown>, fullKey)
      );
    } else if (Array.isArray(value)) {
      result[fullKey] = value.map(String).join(", ");
    } else {
      result[fullKey] =
        value === null || value === undefined ? "" : String(value);
    }
  }
  return result;
};

export const writeOutputFile = async (
  filePath: string,
  data: Record<string, unknown>[],
  format: string
): Promise<void> => {
  if (format === "csv") {
    const flattened = data.map((row) => flattenObject(row));
    const csv = Papa.unparse(flattened);
    await writeFile(filePath, `${csv}\n`);
  } else {
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
  }
};

export const unflattenObject = (
  flat: Record<string, string>
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (value === "") {
      continue;
    }
    const parts = key.split(".");
    if (parts.length === 1) {
      result[key] = value;
    } else {
      const [prefix, ...rest] = parts;
      const nested = (result[prefix] ?? {}) as Record<string, unknown>;
      nested[rest.join(".")] = value;
      result[prefix] = nested;
    }
  }
  return result;
};
