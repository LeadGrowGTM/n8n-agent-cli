# n8n-agent-cli

CLI + MCP server for managing n8n workflows and triggering webhook-based tools from AI agents. Core pattern: agent sends a scoped JSON payload to a webhook URL, n8n runs the workflow with its own stored credentials, agent gets structured JSON back. Agent never touches an API key.

## Runtime

Runs on Node 20+. Built with TypeScript + tsup (ESM output).

```bash
bun run build       # compile src/ -> dist/
bun run dev         # watch mode
bun run typecheck   # tsc --noEmit
```

## Install (published)

```bash
npm install -g n8n-agent-cli
# or
npx n8n-agent-cli --help
```

## Connect to an n8n instance

```bash
n8n-agent instance connect \
  --url https://YOUR-INSTANCE.app.n8n.cloud \
  --api-key YOUR_N8N_API_KEY

n8n-agent instance health
```

Config persists to `~/.n8n-agent/config.json`. The MCP server reads this automatically.

## Environment Variables

| Variable | Description |
|---|---|
| `N8N_URL` | n8n instance URL (overrides saved config) |
| `N8N_API_KEY` | n8n API key (overrides saved config) |
| `N8N_AGENT_JSON` | Set to `1` to force JSON output in non-pipe contexts |

## CLI Reference

### Instance

```bash
n8n-agent instance connect --url <url> --api-key <key> [--name <alias>]
n8n-agent instance health
```

### Workflows

```bash
n8n-agent workflows list [--active] [--tags <tag>] [--limit <n>]
n8n-agent workflows get --id <id>
n8n-agent workflows activate --id <id>
n8n-agent workflows deactivate --id <id>
n8n-agent workflows delete --id <id>
```

### Executions

```bash
n8n-agent executions list [--workflow-id <id>] [--status success|error|waiting] [--limit <n>]
n8n-agent executions get --id <id>
n8n-agent executions delete --id <id>
```

### Webhooks (zero-trust tool calls)

```bash
# Production webhook — workflow must be active
n8n-agent webhooks trigger --url <webhook-url> --payload '{"key": "value"}'

# Test webhook — workflow must be in "Listen for Test Event" mode
n8n-agent webhooks test --url <test-url> --payload '{"key": "value"}'
```

### Credentials

```bash
n8n-agent credentials list       # names/types only — values never exposed
n8n-agent credentials delete --id <id>
```

### MCP Server

```bash
n8n-agent mcp    # stdio transport for Claude Code / Claude Desktop
```

## MCP Config (Claude Code / Claude Desktop)

```json
{
  "mcpServers": {
    "n8n-agent": {
      "command": "n8n-agent",
      "args": ["mcp"],
      "env": {
        "N8N_URL": "https://YOUR-INSTANCE.app.n8n.cloud",
        "N8N_API_KEY": "YOUR_N8N_API_KEY"
      }
    }
  }
}
```

If `~/.n8n-agent/config.json` is set, the env vars are optional.

## Workflow Templates

`templates/` contains importable n8n workflow JSON:

- `zero-trust-crm-query.workflow.json` — webhook → validate → CRM → respond
- `hitl-gate.workflow.json` — human-in-the-loop approval gate pattern

## Skills (Usage Guides)

`skills/` contains SKILL.md files for four n8n patterns:

| Skill | Pattern |
|---|---|
| `n8n-crm-query` | Zero-trust CRM reads via webhook |
| `n8n-ai-router` | Route agent decisions through n8n logic |
| `n8n-cron-agent` | Scheduled agent triggers |
| `n8n-hitl-gate` | Human approval gate before destructive actions |

## Critical Gotchas

- Webhook trigger node must have **Response Mode: "Using 'Respond to Webhook' Node"** — otherwise `webhooks trigger` hangs waiting for a response that never comes.
- Production webhooks require the workflow to be **active**. Test webhooks require the workflow to be in **Listen for Test Event** mode. These are mutually exclusive states.
- CLI auto-detects pipes and switches to JSON output. Set `N8N_AGENT_JSON=1` to force JSON in scripts that don't pipe.
- The MCP server exposes n8n tools to agents. Define each webhook tool in the agent's SOUL.md or system prompt — include the URL, payload schema, and a note that credentials are managed in n8n.
