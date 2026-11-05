# Restore Legacy Sessions Plugin

Nekode official plugin for restoring old ACP-era Nekode session snapshots into the new task index and CLI session DB.

This plugin is bundled as `restore-legacy-sessions@zcode-plugins-official` and is disabled by default. Enable it only when you need to inspect or restore old session data.

## Enable

```sh
zcode plugins enable restore-legacy-sessions
```

Or inside a Nekode session:

```text
/plugins enable restore-legacy-sessions
```

Changes apply to new sessions. After enabling, use:

```text
/restore-legacy-sessions
```

## Data Boundaries

- Default source: `~/.nekode/v2/sessions`
- Task index destination: `~/.nekode/v2/tasks-index.sqlite`
- CLI session DB destination: `~/.nekode/cli/db/db.sqlite`

The restore scripts create timestamped DB backups before writing. Restored ACP-era conversations are persisted as normal `glm` Nekode Agent history and do not write `migration_source`.

## Development

This is a skill-only / command-only plugin. It has no MCP server and no build step.
