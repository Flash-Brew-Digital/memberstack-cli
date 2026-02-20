import { describe, expect, it, vi } from "vitest";

// Set NO_COLOR before any color library is imported
process.env.NO_COLOR = "1";

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape detection
const ANSI_REGEX = /\x1b\[[\d;]*m/;

vi.mock("../../src/lib/program.js", () => ({
  program: { opts: () => ({}) },
}));

const { printSuccess, printError, printTable, printRecord } = await import(
  "../../src/lib/utils.js"
);

describe("no-color output", () => {
  it("printSuccess outputs without ANSI codes", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    printSuccess("done");
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0]).not.toMatch(ANSI_REGEX);
    expect(write.mock.calls[0][0]).toContain("done");
    write.mockRestore();
  });

  it("printError outputs without ANSI codes", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    printError("fail");
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0]).not.toMatch(ANSI_REGEX);
    expect(write.mock.calls[0][0]).toContain("fail");
    write.mockRestore();
  });

  it("printTable outputs without ANSI codes", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    printTable([{ id: "1", name: "Test" }]);
    expect(write).toHaveBeenCalledOnce();
    const output = write.mock.calls[0][0] as string;
    expect(output).not.toMatch(ANSI_REGEX);
    expect(output).toContain("id");
    expect(output).toContain("name");
    write.mockRestore();
  });

  it("printRecord outputs without ANSI codes", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    printRecord({ id: "1", name: "Test" });
    expect(write).toHaveBeenCalledOnce();
    const output = write.mock.calls[0][0] as string;
    expect(output).not.toMatch(ANSI_REGEX);
    expect(output).toContain("id");
    write.mockRestore();
  });
});
