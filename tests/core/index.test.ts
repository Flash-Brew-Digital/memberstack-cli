import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalArgv = [...process.argv];
const originalNoColor = process.env.NO_COLOR;

const mockAddCommand = vi.fn();
const mockParseAsync = vi.fn().mockResolvedValue(undefined);
const mockAction = vi.fn();
const mockHelp = vi.fn();

vi.mock("../../src/lib/program.js", () => ({
  program: {
    action: (...args: unknown[]) => mockAction(...args),
    addCommand: (...args: unknown[]) => mockAddCommand(...args),
    parseAsync: (...args: unknown[]) => mockParseAsync(...args),
    help: (...args: unknown[]) => mockHelp(...args),
  },
}));

vi.mock("../../src/commands/apps.js", () => ({ appsCommand: "apps" }));
vi.mock("../../src/commands/auth.js", () => ({ authCommand: "auth" }));
vi.mock("../../src/commands/custom-fields.js", () => ({
  customFieldsCommand: "custom-fields",
}));
vi.mock("../../src/commands/members.js", () => ({
  membersCommand: "members",
}));
vi.mock("../../src/commands/permissions.js", () => ({
  permissionsCommand: "permissions",
}));
vi.mock("../../src/commands/plans.js", () => ({ plansCommand: "plans" }));
vi.mock("../../src/commands/prices.js", () => ({ pricesCommand: "prices" }));
vi.mock("../../src/commands/providers.js", () => ({
  providersCommand: "providers",
}));
vi.mock("../../src/commands/records.js", () => ({
  recordsCommand: "records",
}));
vi.mock("../../src/commands/skills.js", () => ({
  skillsCommand: "skills",
}));
vi.mock("../../src/commands/tables.js", () => ({ tablesCommand: "tables" }));
vi.mock("../../src/commands/users.js", () => ({ usersCommand: "users" }));
vi.mock("../../src/commands/whoami.js", () => ({
  whoamiCommand: "whoami",
}));

describe("index", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    mockAddCommand.mockClear();
    mockParseAsync.mockClear();
    mockAction.mockClear();
    mockHelp.mockClear();
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    process.argv = originalArgv;
    stderrSpy.mockRestore();
    if (originalNoColor === undefined) {
      // biome-ignore lint/performance/noDelete: process.env requires delete to unset
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = originalNoColor;
    }
  });

  it("prints banner by default", async () => {
    process.argv = ["node", "memberstack"];
    // biome-ignore lint/performance/noDelete: process.env requires delete to unset
    delete process.env.NO_COLOR;

    await import("../../src/index.js");

    expect(stderrSpy).toHaveBeenCalled();
  });

  it("suppresses banner with --quiet", async () => {
    process.argv = ["node", "memberstack", "--quiet"];

    await import("../../src/index.js");

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("suppresses banner with -q", async () => {
    process.argv = ["node", "memberstack", "-q"];

    await import("../../src/index.js");

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("sets NO_COLOR when --no-color is in argv", async () => {
    process.argv = ["node", "memberstack", "--no-color"];
    // biome-ignore lint/performance/noDelete: process.env requires delete to unset
    delete process.env.NO_COLOR;

    await import("../../src/index.js");

    expect(process.env.NO_COLOR).toBe("1");
  });

  it("sets NO_COLOR when NO_COLOR env is already set", async () => {
    process.argv = ["node", "memberstack"];
    process.env.NO_COLOR = "true";

    await import("../../src/index.js");

    expect(process.env.NO_COLOR).toBe("1");
  });

  it("registers all 13 commands", async () => {
    process.argv = ["node", "memberstack"];

    await import("../../src/index.js");

    expect(mockAddCommand).toHaveBeenCalledTimes(13);
  });

  it("calls parseAsync", async () => {
    process.argv = ["node", "memberstack"];

    await import("../../src/index.js");

    expect(mockParseAsync).toHaveBeenCalled();
  });

  it("sets default action to show help", async () => {
    process.argv = ["node", "memberstack"];

    await import("../../src/index.js");

    expect(mockAction).toHaveBeenCalledWith(expect.any(Function));
    const actionCallback = mockAction.mock.calls[0][0] as () => void;
    actionCallback();
    expect(mockHelp).toHaveBeenCalled();
  });
});
