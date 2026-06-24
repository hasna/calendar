# Open Calendar

Universal calendar management for AI coding agents. The package exposes a Bun
CLI, an MCP server, and a small HTTP server.

## CLI Output

Human-readable list and search commands are compact by default so agent
terminals do not fill with full records. Default output shows essential fields,
caps the first page at 20 rows, and prints a hint for the next step.

Use these flags to disclose more detail:

- `--limit <n>` changes the number of rows in the current page.
- `--cursor <n>` starts from a later row offset.
- `--verbose` adds secondary fields such as descriptions, locations, IDs, and
  timestamps without switching to JSON.
- `--json` keeps machine-readable output as the existing full JSON record array
  unless paging is explicitly requested with `--limit` or `--cursor`.
- `--json --limit` or `--json --cursor` returns a pagination envelope:
  `{ "items": [...], "total": 42, "limit": 20, "cursor": 0, "next_cursor": 20 }`.
- Detail commands such as `calendar show <id>` and `calendar org-show <id>`
  return a focused record when you know the ID.

Examples:

```bash
calendar list --calendar cal_123
calendar list --calendar cal_123 --cursor 20
calendar list --calendar cal_123 --limit 5 --verbose
calendar show evt_123
calendar list --calendar cal_123 --json
```

MCP list/search tools use the same gradual disclosure model. They return compact
summary envelopes by default and accept `limit`, `cursor`, and `verbose` fields
where applicable.
