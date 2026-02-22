# Architecture

> **Project**: Memberstack CLI
> **Repository**: https://github.com/Flash-Brew-Digital/memberstack-cli
> **Last updated**: 2026-02-22

## Overview

Memberstack CLI is a Node.js command-line tool for managing Memberstack apps, members, plans, data tables, records, and custom fields. It authenticates via OAuth 2.0 (PKCE) and communicates with the Memberstack GraphQL API. Output is rendered as formatted tables by default or raw JSON with `--json`.

## Project Structure

```
memberstack-cli/
├── src/
│   ├── index.ts                # Entry point — banner, command registration, parseAsync
│   ├── commands/               # One file per command group
│   │   ├── apps.ts             # App CRUD (current, create, update, delete, restore)
│   │   ├── auth.ts             # OAuth login, logout, status
│   │   ├── custom-fields.ts    # Custom field listing
│   │   ├── members.ts          # Member CRUD, search, pagination
│   │   ├── permissions.ts      # Permission CRUD, link/unlink to plans and members
│   │   ├── plans.ts            # Plan CRUD, ordering, redirects, permissions
│   │   ├── prices.ts           # Price management (create, update, activate, deactivate, delete)
│   │   ├── records.ts          # Record CRUD, query, find, import/export, bulk ops
│   │   ├── skills.ts           # Agent skill add/remove (wraps npx skills)
│   │   ├── providers.ts        # Auth provider management (list, configure, remove)
│   │   ├── reset.ts            # Delete local data files and clear authentication
│   │   ├── sso.ts              # SSO app management (list, create, update, delete)
│   │   ├── tables.ts           # Data table CRUD, describe
│   │   ├── update.ts           # Self-update CLI via detected package manager
│   │   ├── users.ts            # App user management (list, get, add, remove, update-role)
│   │   └── whoami.ts           # Show current app and user
│   │
│   └── lib/                    # Shared utilities
│       ├── constants.ts        # API URLs, OAuth endpoints, rate limit delay
│       ├── csv.ts              # CSV/JSON file reading, writing, flattening
│       ├── graphql-client.ts   # Authenticated GraphQL request wrapper
│       ├── oauth.ts            # OAuth 2.0 PKCE flow (register, exchange, refresh, revoke)
│       ├── program.ts          # Commander program instance with global options
│       ├── token-storage.ts    # Token persistence (~/.memberstack/auth.json)
│       ├── types.ts            # Shared TypeScript interfaces
│       └── utils.ts            # Output helpers (printTable, printRecord, printJson, etc.)
│
├── tests/
│   ├── commands/               # Command-level unit tests
│   │   ├── helpers.ts          # Shared test utilities (runCommand, createMockSpinner)
│   │   ├── apps.test.ts
│   │   ├── custom-fields.test.ts
│   │   ├── members.test.ts
│   │   ├── permissions.test.ts
│   │   ├── plans.test.ts
│   │   ├── prices.test.ts
│   │   ├── records.test.ts
│   │   ├── skills.test.ts
│   │   ├── providers.test.ts
│   │   ├── reset.test.ts
│   │   ├── sso.test.ts
│   │   ├── tables.test.ts
│   │   ├── update.test.ts
│   │   ├── users.test.ts
│   │   └── whoami.test.ts
│   │
│   └── core/                   # Core library tests
│       ├── auth.test.ts
│       ├── csv.test.ts
│       ├── graphql-client.test.ts
│       ├── index.test.ts
│       ├── no-color.test.ts
│       ├── oauth.test.ts
│       ├── program.test.ts
│       ├── program-options.test.ts
│       ├── quiet.test.ts
│       ├── token-storage.test.ts
│       └── utils.test.ts
│
├── dist/                       # Compiled output (ESM)
├── tsup.config.ts              # Bundler config (esbuild via tsup)
├── vitest.config.ts            # Test config (mockReset, restoreMocks, v8 coverage)
├── biome.jsonc                 # Linter/formatter (Biome via Ultracite)
└── package.json                # Node >=20, pnpm, type: module
```

## Core Components

### Entry Point (`src/index.ts`)

Propagates `--no-color` / `NO_COLOR` to all color libraries before imports, conditionally prints the ASCII banner (suppressed by `--quiet`), registers all command groups on the shared `program` instance, and calls `parseAsync()`.

### Program (`src/lib/program.ts`)

A shared Commander instance with global options:

- `-j, --json` — output raw JSON instead of formatted tables (env: `MEMBERSTACK_JSON`)
- `-q, --quiet` — suppress banner and non-essential output
- `--no-color` — disable color output (respects the `NO_COLOR` standard)
- `--mode <mode>` — set environment mode: `sandbox` (default) or `live` (env: `MEMBERSTACK_MODE`)
- `--live` / `--sandbox` — shorthands for `--mode live` and `--mode sandbox`

### Commands (`src/commands/`)

Each file exports a Commander `Command` with subcommands. Most commands follow the same pattern:

1. Start a `yocto-spinner`
2. Call `graphqlRequest()` with a query/mutation and variables
3. Stop the spinner
4. Output results via `printTable()`, `printRecord()`, or `printSuccess()`
5. Catch errors and set `process.exitCode = 1`

The `skills` and `update` commands are exceptions — they wrap child processes (`npx skills` and the user's package manager respectively) instead of calling the GraphQL API. The `reset` command performs local cleanup only (deletes `members.json`/`members.csv` and clears stored auth tokens).

Repeatable options use a `collect` helper: `(value, previous) => [...previous, value]`.

Boolean toggles use Commander's `--flag` / `--no-flag` pairs.

Update commands validate that at least one option was provided before making the API call.

### GraphQL Client (`src/lib/graphql-client.ts`)

A single `graphqlRequest<T>()` function that:

1. Retrieves a valid access token (refreshing if needed)
2. Retrieves the app ID from stored tokens
3. Sends a `POST` to the Memberstack GraphQL API with `Authorization` and `ms-app-id` headers
4. Handles GraphQL errors (in response body) and HTTP errors separately
5. Returns typed `data` from the response

### Authentication (`src/lib/oauth.ts` + `src/lib/token-storage.ts`)

OAuth 2.0 Authorization Code flow with PKCE:

1. **Register** — dynamic client registration at `mcp.memberstack.com/oauth/register`
2. **Authorize** — opens browser to authorization URL with code challenge (S256)
3. **Exchange** — trades authorization code for access + refresh tokens
4. **Refresh** — automatically refreshes expired tokens (60s buffer)
5. **Revoke** — revokes refresh token on logout

Tokens are stored in `~/.memberstack/auth.json` with restrictive file permissions (`0o600`). The app ID is extracted from the JWT access token payload.

### Output Utilities (`src/lib/utils.ts`)

- `printTable()` — renders data as a `cli-table3` table to stderr (or JSON to stdout with `--json`)
- `printRecord()` — renders a single object as a vertical key-value table
- `printJson()` — writes raw JSON to stdout
- `printSuccess()` / `printError()` — colored status messages to stderr (`printSuccess` is suppressed by `--quiet`)
- `parseKeyValuePairs()` — parses `key=value` strings for `--data` options
- `parseWhereClause()` — parses `field operator value` filter syntax for `--where`
- `parseJsonString()` — parses raw JSON strings for `--query`

### CSV/JSON I/O (`src/lib/csv.ts`)

Handles import/export for the `records` command:

- `readInputFile()` — reads CSV (via PapaParse) or JSON files
- `writeOutputFile()` — writes CSV or JSON with optional object flattening
- `flattenObject()` / `unflattenObject()` — converts nested data fields to/from dot-notation

## Data Flow

```
User → Commander (parse args)
     → Command action handler
     → graphqlRequest() → token-storage (get/refresh token)
                        → fetch() → Memberstack GraphQL API
     → printTable() / printRecord() → stdout/stderr
```

All user-facing output (tables, spinners, messages) goes to **stderr**. JSON output goes to **stdout**, allowing piping and redirection.

## Dependencies

| Package | Purpose |
|---|---|
| `commander` | CLI argument parsing and subcommands |
| `cli-table3` | Formatted terminal table output |
| `yocto-spinner` | Loading spinners |
| `picocolors` | Terminal color output |
| `open` | Opens browser for OAuth login |
| `papaparse` | CSV parsing and generation |

Dev: `tsup` (bundler), `tsx` (dev runner), `typescript`, `vitest` (tests), `@vitest/coverage-v8` (coverage), `biome` via `ultracite` (lint/format).

## Build & CI

- **Build**: `tsup` compiles `src/index.ts` to ESM in `dist/`
- **Test**: `vitest` with mocked GraphQL client and spinner, covers all commands and core libraries (`pnpm test:coverage` for v8 coverage report)
- **Lint**: Biome via `ultracite` (`pnpm check` / `pnpm fix`)
- **Type check**: `tsc --noEmit` (`pnpm type-check`)
- **PR checks** (`.github/workflows/pr-checks.yml`): type-check, lint, build, test on Node 24
- **Release** (`.github/workflows/release.yml`): release-please for versioning + npm publish with OIDC provenance

## Published Package

Only `dist/` and `README.md` are included in the npm package (`files` field). The `bin` entry maps `memberstack` to `dist/index.js`.
