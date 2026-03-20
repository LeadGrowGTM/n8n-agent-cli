# n8n-agent-cli

**AI agent CLI + MCP server for n8n — zero-trust webhook tool platform for OpenClaw and AI agents.**

Give your AI agent the power of n8n's 400+ integrations — without ever handing it an API key.

```bash
npm install -g n8n-agent-cli
```

---

## The Problem

When AI agents have direct API access, three things go wrong:

1. **Non-determinism** — the same instruction produces different API calls across runs. For business-critical operations, this is a liability.
2. **Over-privileged access** — a raw Airtable key can read every table, write every field, delete every record. Your agent only needed 3 fields from one table.
3. **No audit trail** — when something goes wrong, the LLM context window is your only log. That's not good enough for a business.

## The Solution: Webhook-as-Tool

Build a locked n8n workflow. Give the agent only a **webhook URL**.

```
Agent → POST { payload } → Webhook URL
                                │
                          n8n Workflow
                          (validation → CRM/API → format)
                          (credentials stored in n8n vault)
                                │
                          Respond to Webhook
                                │
Agent ← structured JSON result ←┘
```

The agent sends a scoped payload. n8n runs the exact workflow you designed — deterministic, logged, credential-safe. The agent gets data back. It never touched an API key.

This is the **zero-trust tool pattern**: the webhook URL is a proxy. What it proxies to — Airtable, HubSpot, Salesforce, Stripe, your database — is completely hidden from the agent.

---

## Install

```bash
# CLI
npm install -g n8n-agent-cli

# Or run directly
npx n8n-agent-cli --help
```

## Quick Start

### 1. Connect to your n8n instance

```bash
n8n-agent instance connect \
  --url https://YOUR-INSTANCE.app.n8n.cloud \
  --api-key YOUR_N8N_API_KEY
```

Get your API key in n8n: `Settings → API → Create API key`

### 2. Verify connection

```bash
n8n-agent instance health
```

### 3. List your workflows

```bash
n8n-agent workflows list
n8n-agent workflows list --active       # only active
n8n-agent workflows list --tags agent-tools  # filter by tag
```

### 4. Trigger a webhook tool

```bash
n8n-agent webhooks trigger \
  --url https://YOUR-INSTANCE.app.n8n.cloud/webhook/query-leads \
  --payload '{ "status": "Open", "limit": 10 }'
```

### 5. Start the MCP server (for OpenClaw / Claude Desktop)

```bash
n8n-agent mcp
```

---

## MCP Configuration

Add to your OpenClaw or Claude Desktop config:

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

Or use a saved instance connection — the MCP server reads `~/.n8n-agent/config.json` automatically.

---

## CLI Reference

### Instance Management

```bash
n8n-agent instance connect --url <url> --api-key <key> [--name <alias>]
n8n-agent instance health
```

### Workflows

```bash
n8n-agent workflows list [--active] [--tags <tag>] [--limit <n>]
n8n-agent workflows get --id <workflow-id>
n8n-agent workflows activate --id <workflow-id>
n8n-agent workflows deactivate --id <workflow-id>
n8n-agent workflows delete --id <workflow-id>
```

### Executions

```bash
n8n-agent executions list [--workflow-id <id>] [--status success|error|waiting] [--limit <n>]
n8n-agent executions get --id <execution-id>
n8n-agent executions delete --id <execution-id>
```

### Webhooks

```bash
# Trigger a production webhook tool (the core zero-trust call)
n8n-agent webhooks trigger --url <webhook-url> --payload '<json>'

# Test a webhook while developing (workflow must be in "Listen for Test Event")
n8n-agent webhooks test --url <test-webhook-url> --payload '<json>'
```

### Credentials

```bash
# List what's in the vault (names/types only — never exposes values)
n8n-agent credentials list

n8n-agent credentials delete --id <credential-id>
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `N8N_URL` | n8n instance URL (overrides saved config) |
| `N8N_API_KEY` | n8n API key (overrides saved config) |
| `N8N_AGENT_JSON` | Set to `1` to force JSON output (auto-detected in pipes) |

---

## The Four Patterns

### Pattern 1: Zero-Trust CRM Query

Build one n8n workflow per CRM operation. The workflow validates the payload, queries the CRM using stored credentials, and returns structured JSON. The agent has no CRM credentials — only the webhook URL.

**n8n workflow structure:**
```
Webhook Trigger → Code (validate) → Airtable/HubSpot/Salesforce → Respond to Webhook
```

**Critical Webhook Trigger setting:** `Response Mode: "Using 'Respond to Webhook' Node"`

**Agent tool definition (add to SOUL.md):**
```markdown
### query_leads — n8n Tool
URL: https://YOUR-INSTANCE/webhook/query-leads
Method: POST
Payload: { status: "Open"|"Qualified"|"Lost", limit: 1-100 }
Returns: { status, data: [], count }
Note: API key managed in n8n. Never access CRM directly.
```

→ Full guide: [skills/n8n-crm-query/SKILL.md](skills/n8n-crm-query/SKILL.md)
→ Template: [templates/zero-trust-crm-query.workflow.json](templates/zero-trust-crm-query.workflow.json)

---

### Pattern 2: Human-in-the-Loop (HITL) Gate

For high-stakes operations — creating CRM records, sending emails, moving money — insert a Slack approval step. The agent initiates the action. A human confirms before it executes.

**n8n workflow structure:**
```
Webhook Trigger → Validate → Slack (approval request) → Wait → IF approved?
  YES → Execute action → Respond: { status: "completed" }
  NO  → Respond: { status: "rejected" }
  Timeout → Respond: { status: "timeout" }
```

The agent handles each response gracefully. As trust builds, remove the HITL gate — the execution history is your evidence.

→ Full guide: [skills/n8n-hitl-gate/SKILL.md](skills/n8n-hitl-gate/SKILL.md)
→ Template: [templates/hitl-gate.workflow.json](templates/hitl-gate.workflow.json)

---

### Pattern 3: Cron Automation (n8n Orchestrates, Agent Reasons)

For scheduled automation, don't ask the agent to manage the cron. n8n's Cron trigger is the orchestrator. OpenClaw is one node — called via HTTP Request — handling only the reasoning step (scoring, classifying, summarizing).

**Daily lead scoring example:**
```
n8n Cron (9am) → Fetch new contacts → HTTP Request to OpenClaw → Score each lead
→ IF score > 70: Enroll in Instantly → IF score < 30: Mark Disqualified → Slack summary
```

Cron timing, API calls, and routing: **deterministic (n8n)**.
Lead scoring judgment: **OpenClaw**.

→ Full guide: [skills/n8n-cron-agent/SKILL.md](skills/n8n-cron-agent/SKILL.md)

---

### Pattern 4: AI Model Router

Use n8n's Switch node to route agent calls to different AI models based on task type. OpenClaw calls one webhook URL. n8n routes to Grok for web search, a RAG agent for knowledge lookup, a vision model for images. No extra API keys needed by the agent.

```
Webhook: { task_type, query } → Switch →
  "web_search"     → Grok API
  "knowledge_base" → RAG Agent (Pinecone + Claude)
  "image_analysis" → Vision model
→ Respond: { status, result, model_used }
```

New model? Add one n8n node. Zero OpenClaw reconfiguration.

→ Full guide: [skills/n8n-ai-router/SKILL.md](skills/n8n-ai-router/SKILL.md)

---

## Building a Webhook Tool in n8n (Step-by-Step)

1. **New Workflow** → name it `[Tool] Your Tool Name` → tag: `agent-tools`

2. **Webhook Trigger node:**
   - HTTP Method: `POST`
   - Path: `your-tool-name` (becomes the URL path)
   - **Response Mode: `Using 'Respond to Webhook' Node`** ← required

3. **Code node (validation):** Always validate before touching any API.
   ```javascript
   const { status, limit } = $json.body;
   if (!['Open', 'Qualified'].includes(status)) throw new Error(`Invalid status: ${status}`);
   return { status, limit: Math.min(limit || 20, 100) };
   ```

4. **Your logic nodes:** Airtable, HubSpot, HTTP Request, etc. — using stored credentials.

5. **Respond to Webhook node:**
   ```json
   { "status": "success", "data": [], "count": 0, "message": "..." }
   ```

6. **Test:** Click `Listen for Test Event` → run `n8n-agent webhooks test --url <test-url> --payload '{}'`

7. **Activate** → toggle workflow to Active → production URL is live.

8. **Add to OpenClaw SOUL.md** with the production URL, payload schema, and usage notes.

---

## Debugging Executions

Every agent tool call creates a logged execution in n8n.

```bash
# See recent executions
n8n-agent executions list --limit 20

# Find failures
n8n-agent executions list --status error

# Full trace for a specific run
n8n-agent executions get --id EXECUTION_ID
```

In the n8n UI: `Executions` → click any execution → click any node → see exact input/output.

Failed executions can be retried manually in the n8n UI with the original payload — no need to re-trigger from the agent.

---

## Workflow Templates

Pre-built n8n workflows ready to import:

| Template | Pattern | Description |
|----------|---------|-------------|
| [zero-trust-crm-query.workflow.json](templates/zero-trust-crm-query.workflow.json) | Pattern 1 | Airtable query — customize for any CRM |
| [hitl-gate.workflow.json](templates/hitl-gate.workflow.json) | Pattern 2 | Slack approval gate for any action |

Import via n8n UI: `Workflows → Import from file`

---

## Security Checklist

Before any webhook tool goes to production:

- [ ] API keys in n8n credential vault (never in workflow code)
- [ ] Webhook URL is HTTPS
- [ ] Payload validated in Code node before any API call
- [ ] Action parameters use enums, not free strings
- [ ] HITL gate added for create/update/delete operations
- [ ] Webhook URL not committed to any public repository

---

## Why n8n-agent-cli vs the existing n8n-cli

The existing [`n8n-cli`](https://www.npmjs.com/package/n8n-cli) on npm is a server-side management tool — it requires n8n's internal packages installed locally and is designed to run *on the n8n server*. It has no MCP support and no concept of AI agent patterns.

`n8n-agent-cli` is built differently:
- **Pure HTTP** — talks to any n8n instance (cloud or self-hosted) via the REST API. No local n8n packages.
- **Agent-first** — every command is an MCP tool. The CLI and MCP server are the same command set.
- **Zero-trust patterns** — designed around the Webhook-as-Tool architecture, not server management.
- **Minimal deps** — Commander + Zod + MCP SDK. That's it.

---

## Contributing

Issues and PRs welcome at [github.com/bcharleson/n8n-agent-cli](https://github.com/bcharleson/n8n-agent-cli).

## License

MIT
