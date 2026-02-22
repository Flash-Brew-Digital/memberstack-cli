# Memberstack CLI

![Flash Brew Digital OSS](https://img.shields.io/badge/Flash_Brew_Digital-OSS-6F4E37?style=for-the-badge&labelColor=E9E3DD)
![MIT License](https://img.shields.io/badge/License-MIT-6F4E37?style=for-the-badge&labelColor=E9E3DD)

Manage your Memberstack account from the terminal. Authenticate via OAuth, then create, read, update, and delete apps, members, plans, data tables, records, and custom fields. Get more done and give your AI agents the power to manage your membership site with ease.

[View Documentation](https://memberstack-cli.flashbrew.digital)

<img width="1200" height="630" alt="Memberstack, meet your terminal." src="https://github.com/user-attachments/assets/14f8f737-02b4-4b6f-8caf-895e64132c57" />

## Installation

```bash
npm install -g memberstack-cli
```

**Requires Node.js 20 or later.**

## Quick Start

```bash
# Authenticate with your Memberstack account
# And choose your application
memberstack auth login

# Verify your identity
memberstack whoami
```

## Usage

```bash
memberstack <command> [subcommand] [params] [options]
```

## Install Agent Skill (Optional)

```bash
memberstack skills add memberstack-cli
```

### Global Options

| Option | Env Var | Description |
|---|---|---|
| `-j, --json` | `MEMBERSTACK_JSON` | Output raw JSON instead of formatted tables |
| `-q, --quiet` | | Suppress banner and non-essential output |
| `--no-color` | `NO_COLOR` | Disable color output (respects the [NO_COLOR standard](https://no-color.org)) |
| `--mode <mode>` | `MEMBERSTACK_MODE` | Set environment mode (`sandbox` or `live`, default: `sandbox`) |
| `--live` | | Shorthand for `--mode live` |
| `--sandbox` | | Shorthand for `--mode sandbox` |

### Commands

| Command | Functionality |
|---|---|
| `auth` | Login, logout, and check authentication status |
| `whoami` | Show current authenticated app and user |
| `apps` | View, create, update, delete, and restore apps |
| `members` | List, create, update, delete, import/export, bulk ops |
| `permissions` | Create, update, delete, and link/unlink to plans and members |
| `plans` | List, create, update, delete, and reorder plans |
| `prices` | Create, update, activate, deactivate, and delete prices |
| `tables` | List, create, update, delete, and describe schema |
| `records` | CRUD, query, import/export, bulk ops |
| `custom-fields` | List, create, update, and delete custom fields |
| `users` | List, get, add, remove, and update roles for app users |
| `providers` | List, configure, and remove auth providers (e.g. Google) |
| `sso` | List, create, update, and delete SSO apps |
| `skills` | Add/remove agent skills for Claude Code and Codex |
| `update` | Update the CLI to the latest version |
| `reset` | Delete local data files and clear authentication |

For full command details and usage, see the [Command Reference](https://memberstack-cli.flashbrew.digital/docs/commands).

## Examples

```bash
# List all members as JSON
memberstack members list --json

# Create a plan
memberstack plans create --name "Pro Plan" --description "Full access"

# Find records with a filter
memberstack records find my_table --where "status equals active" --take 10

# Export members to CSV
memberstack members export --format csv --output members.csv

# Import records from a JSON file
memberstack records import my_table --file data.json

# Use live environment
memberstack members list --mode live
memberstack members list --live
```

## Development

```bash
# Install dependencies
pnpm install

# Run locally (via tsx, no build needed)
pnpm dev -- members list --json

# Build
pnpm build

# Run tests
pnpm test

# Lint
pnpm check

# Fix lint issues
pnpm fix

# Type check
pnpm type-check
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for project structure and design details.

## Resources

[Documentation](https://memberstack-cli.flashbrew.digital)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](.github/CONTRIBUTING.md) for more information.

## License

[MIT License](LICENSE)

## Author

[Ben Sabic](https://bensabic.dev) at [Flash Brew Digital](https://flashbrew.digital)

## Disclaimer

This is not an official Memberstack product. It is an independent, community-driven open-source project and is not affiliated with, endorsed by, or supported by Memberstack. "Memberstack" and the Memberstack logo are the property of Memberstack Inc.

Your OAuth tokens are stored locally on your machine at `~/.memberstack/auth.json` with restrictive file permissions. Credentials are never shared with third parties, the CLI communicates directly with the Memberstack API and nothing else. You can revoke access at any time by running `memberstack auth logout`.
