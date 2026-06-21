---
paths:
  - "src/commands/**/*.ts"
  - "src/mcp/**/*.ts"
---

# Dual-Surface Command Architecture

Every command MUST be defined as a single `CommandDefinition` in `src/commands/`. The MCP server and CLI both consume these definitions — never define behavior in only one surface.

## CommandDefinition contract

- `name`: snake_case, used as MCP tool name (e.g. `workflow_list`)
- `group`: CLI group (e.g. `workflows`)
- `subcommand`: CLI subcommand (e.g. `list`)
- `inputSchema`: Zod schema — the single source of truth for both CLI flags and MCP input validation
- `handler`: receives parsed input + N8nClient, returns data (never prints directly)

## Rules

- Handlers return data. Formatting is handled by `src/core/output.ts`. Never call `console.log` from a handler.
- New command groups get their own file: `src/commands/{group}/index.ts`. Export an array of `CommandDefinition[]`.
- Register new command arrays in `src/commands/index.ts` via `ALL_COMMANDS`.
- All n8n API calls go through `N8nClient` methods in `src/core/client.ts`. Never use raw `fetch` in commands.
- Zod schemas must include `.describe()` on every field — MCP surfaces these as tool parameter descriptions.
