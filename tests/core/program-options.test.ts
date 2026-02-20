import { Command, Option } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

const createProgram = () => {
  const cmd = new Command();
  cmd
    .exitOverride()
    .addOption(
      new Option("-j, --json", "Output raw JSON").env("MEMBERSTACK_JSON")
    )
    .addOption(
      new Option("--mode <mode>", "Set environment mode")
        .choices(["sandbox", "live"])
        .default("sandbox")
        .env("MEMBERSTACK_MODE")
    )
    .addOption(
      new Option("--live", "Shorthand for --mode live").conflicts("sandbox")
    )
    .addOption(
      new Option("--sandbox", "Shorthand for --mode sandbox").conflicts("live")
    )
    .hook("preAction", (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.live) {
        thisCommand.setOptionValueWithSource("mode", "live", "cli");
      } else if (opts.sandbox) {
        thisCommand.setOptionValueWithSource("mode", "sandbox", "cli");
      }
    })
    .option("-q, --quiet", "Suppress banner and non-essential output")
    .action(() => undefined);
  return cmd;
};

const parse = async (args: string[]) => {
  const cmd = createProgram();
  await cmd.parseAsync(["node", "test", ...args]);
  return cmd.opts();
};

describe("program mode options", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to sandbox mode", async () => {
    const opts = await parse([]);
    expect(opts.mode).toBe("sandbox");
  });

  it("--mode live sets mode to live", async () => {
    const opts = await parse(["--mode", "live"]);
    expect(opts.mode).toBe("live");
  });

  it("--mode sandbox explicitly sets sandbox", async () => {
    const opts = await parse(["--mode", "sandbox"]);
    expect(opts.mode).toBe("sandbox");
  });

  it("rejects invalid mode choices", async () => {
    await expect(parse(["--mode", "staging"])).rejects.toThrow();
  });

  it("--live sets mode to live", async () => {
    const opts = await parse(["--live"]);
    expect(opts.mode).toBe("live");
  });

  it("--sandbox sets mode to sandbox", async () => {
    const opts = await parse(["--sandbox"]);
    expect(opts.mode).toBe("sandbox");
  });

  it("--live and --sandbox conflict", async () => {
    await expect(parse(["--live", "--sandbox"])).rejects.toThrow();
  });

  it("MEMBERSTACK_MODE env var sets mode", async () => {
    vi.stubEnv("MEMBERSTACK_MODE", "live");
    const opts = await parse([]);
    expect(opts.mode).toBe("live");
  });

  it("--mode flag overrides MEMBERSTACK_MODE env var", async () => {
    vi.stubEnv("MEMBERSTACK_MODE", "live");
    const opts = await parse(["--mode", "sandbox"]);
    expect(opts.mode).toBe("sandbox");
  });

  it("--live flag overrides MEMBERSTACK_MODE env var", async () => {
    vi.stubEnv("MEMBERSTACK_MODE", "sandbox");
    const opts = await parse(["--live"]);
    expect(opts.mode).toBe("live");
  });
});

describe("program json option", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to no json output", async () => {
    const opts = await parse([]);
    expect(opts.json).toBeUndefined();
  });

  it("--json flag enables json output", async () => {
    const opts = await parse(["--json"]);
    expect(opts.json).toBe(true);
  });

  it("-j shorthand enables json output", async () => {
    const opts = await parse(["-j"]);
    expect(opts.json).toBe(true);
  });

  it("MEMBERSTACK_JSON env var enables json output", async () => {
    vi.stubEnv("MEMBERSTACK_JSON", "1");
    const opts = await parse([]);
    expect(opts.json).toBe(true);
  });

  it("--json flag overrides MEMBERSTACK_JSON env var", async () => {
    vi.stubEnv("MEMBERSTACK_JSON", "0");
    const opts = await parse(["--json"]);
    expect(opts.json).toBe(true);
  });
});

describe("program quiet option", () => {
  it("defaults to no quiet", async () => {
    const opts = await parse([]);
    expect(opts.quiet).toBeUndefined();
  });

  it("--quiet flag enables quiet mode", async () => {
    const opts = await parse(["--quiet"]);
    expect(opts.quiet).toBe(true);
  });

  it("-q shorthand enables quiet mode", async () => {
    const opts = await parse(["-q"]);
    expect(opts.quiet).toBe(true);
  });
});
