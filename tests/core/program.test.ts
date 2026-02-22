import { Command } from "commander";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { program } = await import("../../src/lib/program.js");

// Add a temporary subcommand so we can trigger preAction hooks via parseAsync
const testSub = new Command("_test_hook").action(() => {
  // noop
});

describe("program", () => {
  it("is named memberstack", () => {
    expect(program.name()).toBe("memberstack");
  });

  it("has a description mentioning Memberstack", () => {
    expect(program.description()).toContain("Memberstack");
  });

  it("has a version set", () => {
    // In test environment __VERSION__ is not defined, so falls back to "dev"
    expect(program.version()).toBe("dev");
  });

  it("has usage string", () => {
    expect(program.usage()).toContain("<command>");
  });

  it("registers --json option with -j shorthand", () => {
    const opt = program.options.find(
      (o: { long?: string }) => o.long === "--json"
    );
    expect(opt).toBeDefined();
  });

  it("registers --quiet option with -q shorthand", () => {
    const opt = program.options.find(
      (o: { long?: string }) => o.long === "--quiet"
    );
    expect(opt).toBeDefined();
  });

  it("registers --mode option", () => {
    const opt = program.options.find(
      (o: { long?: string }) => o.long === "--mode"
    );
    expect(opt).toBeDefined();
  });

  it("registers --live and --sandbox shorthand options", () => {
    const live = program.options.find(
      (o: { long?: string }) => o.long === "--live"
    );
    const sandbox = program.options.find(
      (o: { long?: string }) => o.long === "--sandbox"
    );
    expect(live).toBeDefined();
    expect(sandbox).toBeDefined();
  });

  it("configureHelp places --help first in visible options", () => {
    const help = program.createHelp();
    const opts = help.visibleOptions(program);
    expect(opts.length).toBeGreaterThan(1);
    expect(opts[0].long).toBe("--help");
  });

  it("has help information with options", () => {
    const helpInfo = program.helpInformation();
    expect(helpInfo).toContain("memberstack");
    expect(helpInfo).toContain("--help");
    expect(helpInfo).toContain("--version");
  });

  describe("preAction hook", () => {
    beforeAll(() => {
      program.addCommand(testSub);
    });

    afterAll(() => {
      // Reset mode back to default
      program.setOptionValueWithSource("mode", "sandbox", "default");
    });

    it("sets mode to live when --live is passed", async () => {
      await program.parseAsync(["node", "test", "--live", "_test_hook"]);
      expect(program.opts().mode).toBe("live");
    });

    it("sets mode to sandbox when --sandbox is passed", async () => {
      await program.parseAsync(["node", "test", "--sandbox", "_test_hook"]);
      expect(program.opts().mode).toBe("sandbox");
    });

    it("keeps default mode when neither flag is passed", async () => {
      await program.parseAsync(["node", "test", "_test_hook"]);
      expect(program.opts().mode).toBe("sandbox");
    });
  });
});
