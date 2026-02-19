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
memberstack <command> <subcommand> [options]
```

## Install Agent Skill (Optional)

```bash
memberstack skills add memberstack-cli
```

### Global Options

| Option | Description |
|---|---|
| `--json` | Output raw JSON instead of formatted tables |
| `--live` | Use live environment instead of sandbox |

### Commands

#### `auth` — Authentication

| Subcommand | Description |
|---|---|
| `login` | Authenticate with Memberstack via OAuth |
| `logout` | Remove stored authentication tokens |
| `status` | Show current authentication status |

#### `whoami` — Identity

Show the current authenticated app and user.

#### `apps` — App Management

| Subcommand | Description |
|---|---|
| `current` | Show the current app |
| `create` | Create a new app |
| `update` | Update the current app |
| `delete` | Delete an app |
| `restore` | Restore a deleted app |

#### `members` — Member Management

| Subcommand | Description |
|---|---|
| `list` | List members (with pagination) |
| `get <id_or_email>` | Get a member by ID or email |
| `create` | Create a new member |
| `update <id>` | Update a member |
| `delete <id>` | Delete a member |
| `add-plan <id>` | Add a free plan to a member |
| `remove-plan <id>` | Remove a free plan from a member |
| `count` | Show total member count |
| `find` | Find members by field values or plan |
| `stats` | Show member statistics |
| `export` | Export all members to CSV or JSON |
| `import` | Import members from a CSV or JSON file |
| `bulk-update` | Bulk update members from a file |
| `bulk-add-plan` | Add a plan to multiple members |

#### `plans` — Plan Management

| Subcommand | Description |
|---|---|
| `list` | List all plans |
| `get <id>` | Get a plan by ID |
| `create` | Create a new plan |
| `update <id>` | Update a plan (name, status, redirects, permissions, etc.) |
| `delete <id>` | Delete a plan |
| `order` | Reorder plans by priority |

#### `tables` — Data Table Management

| Subcommand | Description |
|---|---|
| `list` | List all data tables |
| `get <table_key>` | Get a data table by key or ID |
| `describe <table_key>` | Show table schema and access rules |
| `create` | Create a new data table |
| `update <id>` | Update a data table |
| `delete <id>` | Delete a data table |

#### `records` — Record Management

| Subcommand | Description |
|---|---|
| `create <table_key>` | Create a new record |
| `update <table_key> <record_id>` | Update a record |
| `delete <table_key> <record_id>` | Delete a record |
| `query <table_key>` | Query records with a JSON filter |
| `count <table_key>` | Count records in a table |
| `find <table_key>` | Find records with friendly filter syntax |
| `export <table_key>` | Export all records to CSV or JSON |
| `import <table_key>` | Import records from a CSV or JSON file |
| `bulk-update` | Bulk update records from a file |
| `bulk-delete <table_key>` | Bulk delete records matching a filter |

#### `custom-fields` — Custom Field Management

| Subcommand | Description |
|---|---|
| `list` | List all custom fields |
| `create` | Create a custom field |
| `update <id>` | Update a custom field |
| `delete <id>` | Delete a custom field |

#### `skills` — Agent Skill Management

| Subcommand | Description |
|---|---|
| `add <skill>` | Add a Memberstack agent skill |
| `remove <skill>` | Remove a Memberstack agent skill |

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
memberstack members list --live
```

## Development

```bash
# Install dependencies
pnpm install

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
