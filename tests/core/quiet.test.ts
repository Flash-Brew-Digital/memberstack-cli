import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/program.js", () => ({
  program: { opts: () => ({ quiet: true }) },
}));

const { printSuccess, printError } = await import("../../src/lib/utils.js");

describe("quiet mode", () => {
  it("printSuccess is suppressed", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    printSuccess("done");
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });

  it("printError still outputs", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    printError("fail");
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0]).toContain("fail");
    write.mockRestore();
  });
});
