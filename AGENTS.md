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
# Production webhook - workflow must be active
n8n-agent webhooks trigger --url <webhook-url> --payload '{"key": "value"}'

# Test webhook - workflow must be in "Listen for Test Event" mode
n8n-agent webhooks test --url <test-url> --payload '{"key": "value"}'
```

### Credentials

```bash
n8n-agent credentials list       # names/types only - values never exposed
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

- `zero-trust-crm-query.workflow.json` - webhook → validate → CRM → respond
- `hitl-gate.workflow.json` - human-in-the-loop approval gate pattern

## Skills (Usage Guides)

`skills/` contains SKILL.md files for four n8n patterns:

| Skill | Pattern |
|---|---|
| `n8n-crm-query` | Zero-trust CRM reads via webhook |
| `n8n-ai-router` | Route agent decisions through n8n logic |
| `n8n-cron-agent` | Scheduled agent triggers |
| `n8n-hitl-gate` | Human approval gate before destructive actions |

## Critical Gotchas

- Webhook trigger node must have **Response Mode: "Using 'Respond to Webhook' Node"** - otherwise `webhooks trigger` hangs waiting for a response that never comes.
- Production webhooks require the workflow to be **active**. Test webhooks require the workflow to be in **Listen for Test Event** mode. These are mutually exclusive states.
- CLI auto-detects pipes and switches to JSON output. Set `N8N_AGENT_JSON=1` to force JSON in scripts that don't pipe.
- The MCP server exposes n8n tools to agents. Define each webhook tool in the agent's SOUL.md or system prompt - include the URL, payload schema, and a note that credentials are managed in n8n.

---

## Full Skill Guide: OpenClaw + n8n (from AGENTS.md)


> **Skill: Using n8n as a Zero-Trust, Deterministic Tool Platform for AI Agents**
>
> This document is the complete operating guide for AI agents (OpenClaw and others)
> and the humans who configure them. It covers every pattern, use case, and
> configuration detail needed to use n8n as a secure execution layer.

---

## Core Philosophy

An AI agent is powerful but non-deterministic. Given the same instruction twice, it may take different paths, use different API parameters, or format a payload differently. For business-critical operations this is a liability.

n8n is the opposite: deterministic, auditable, and credential-safe. Every workflow is locked logic. Every execution is logged with full input/output data at every node.

**The fundamental pattern:**

> Give the agent a webhook URL as its tool - not an API key, not raw access, a proxy.
> The agent sends a structured payload. n8n runs the workflow exactly as designed.
> n8n sends the result back. The agent never touches the underlying API, credential, or database.

This is the **Webhook-as-Tool** pattern. It enables AI agents to operate safely in real business environments where reliability, auditability, and access control matter.

---

## Architecture

```
OpenClaw Agent
    │
    │  POST { structured payload }
    ▼
Webhook URL  ←────── the only credential the agent has
    │
    ▼
n8n Workflow
    ├─ Webhook Trigger        receives payload
    ├─ Code (validation)      sanitize + scope input
    ├─ Logic nodes            Airtable / HubSpot / HTTP / IF / Switch...
    │    └─ credentials stored in n8n vault - agent never sees these
    └─ Respond to Webhook     returns result synchronously
    │
    ▼
Agent receives structured JSON - { status, data, message }
```

The round-trip is **synchronous from the agent's perspective**. The agent fires a POST and waits. n8n's `Respond to Webhook` node makes this native - no tunneling, no callbacks.

---

## The Three Security Guarantees

### Guarantee 1: API Key Isolation

API keys for every external service (Airtable, HubSpot, Salesforce, Stripe, Instantly, Slack, databases, etc.) live in n8n's encrypted credential vault. They are referenced by workflow nodes and never passed through payloads, never visible in workflow UI, never accessible to the agent.

The agent's only credential is the webhook URL. If the agent's context is compromised, the attacker gets a scoped webhook proxy - not the underlying API keys.

**How to store credentials:** `n8n Settings → Credentials → + Add Credential` → select service type → enter key once → reference by name in node dropdowns. The value never appears again.

### Guarantee 2: Scoped, Locked Logic

The workflow defines exactly what can happen. The agent can only influence variables the workflow is explicitly designed to accept. It cannot rewrite queries, access other tables, change returned fields, or expand permissions beyond what the workflow allows.

Design workflows to accept the **minimum** parameters the agent needs. Use enums for all action fields, never free-form strings. Validate before every API call.

### Guarantee 3: Full Audit Trail

Every agent tool call creates a permanent execution record in n8n with:
- Full input payload (what the agent sent)
- Node-level input/output (what happened at each step)
- Error details (exactly which node failed and why)
- Timing (start, stop, duration per node)
- Status (success / error / waiting / running)

This is what makes AI agents enterprise-deployable: a non-technical business owner can review every tool call the agent ever made without touching the LLM context.

---

## Skill 1: Zero-Trust CRM Query

### What this solves

Agents querying or writing to CRMs (Airtable, HubSpot, Salesforce, Notion, Monday.com, Zoho) need access to company data - but should never have raw API access to the whole system.

### When to use

Any time an agent needs to:
- Read contacts, leads, deals, accounts, or any CRM record
- Write or update CRM records
- Check pipeline status, counts, or summaries
- Look up a specific contact by email or ID

### n8n Workflow Structure

```
Webhook Trigger (POST, Response Mode: "Using Respond to Webhook Node")
  └─ Code node: validate + sanitize payload
  └─ CRM node (Airtable / HubSpot / Salesforce / etc.) using stored credential
  └─ Code node: format response (optional)
  └─ Respond to Webhook: { status, data, count, message }
```

### Building the Webhook Trigger

Settings that matter:
| Field | Value |
|-------|-------|
| HTTP Method | POST |
| Path | descriptive - `query-leads`, `create-contact`, `get-deal` |
| **Response Mode** | **Using 'Respond to Webhook' Node** ← critical |
| Authentication | None (or Basic Auth for extra security) |

### Payload Validation (Code node - never skip this)

```javascript
// Always validate before touching any API
const { status, limit } = $json.body;

const validStatuses = ['Open', 'Qualified', 'Lost', 'Closed Won', 'Closed Lost'];
if (!validStatuses.includes(status)) {
  throw new Error(
    `Invalid status: "${status}". Allowed values: ${validStatuses.join(', ')}`
  );
}

return {
  status,
  limit: Math.min(Math.max(1, limit || 20), 100) // cap between 1–100
};
```

### Standard Response Schema

Use this shape for every workflow - agents learn to handle it consistently:

```json
{
  "status": "success",
  "data": [],
  "count": 0,
  "message": "Found 12 Open leads",
  "timestamp": "2026-03-20T09:00:00Z"
}
```

### OpenClaw Tool Definition (add to SOUL.md)

```markdown
### query_leads - n8n Webhook Tool
URL: https://YOUR-INSTANCE.app.n8n.cloud/webhook/query-leads
Method: POST
When to use: User asks about leads, prospects, pipeline status, or contact counts
Payload:
  - status: "Open" | "Qualified" | "Lost" | "Closed Won" | "Closed Lost"  (required)
  - limit: number 1–100 (optional, default 20)
Returns: { status, data: Lead[], count, message }
Security: The Airtable API key is stored in n8n. Never ask for it or access Airtable directly.
Error handling: If status is "error", describe the error and suggest the user check n8n executions.
```

### Real-World Examples

**Airtable lead query:**
```
Webhook → Validate → Airtable List (filter by Status, max records) → Respond
```

**HubSpot contact create:**
```
Webhook → Validate → HubSpot Create Contact → Respond: { deal_id, url }
```

**Salesforce opportunity update:**
```
Webhook → Validate → Salesforce Update Record → Respond: { updated: true }
```

**Cross-platform sync (read one, write another):**
```
Webhook → Validate → Airtable Get → Transform (Code node) → HubSpot Create → Respond
```

---

## Skill 2: Human-in-the-Loop (HITL) Approval Gates

### What this solves

For operations that are irreversible, expensive, or have significant business impact, a human should confirm before the action executes. The agent initiates - a human approves - n8n executes.

### When to add a HITL gate

Required for:
- Creating or deleting CRM records (deals, contacts, companies)
- Sending external communications (email campaigns, SMS, Slack to external channels)
- Enrolling or unenrolling contacts in email sequences
- Any payment or billing operation
- Modifying a production database
- Any operation where "undo" is difficult or impossible

Optional (based on risk tolerance):
- Updating CRM fields on existing records
- Adding tags or notes to contacts
- Moving a deal between pipeline stages

### n8n HITL Workflow

```
Webhook Trigger
  └─ Code: validate + describe the action in plain language
  └─ Slack: "OpenClaw wants to [action]. [Approve] [Reject]"
  └─ Wait node: pause until approval webhook called (up to 24h)
  └─ IF: decision === "approved"?
       YES → Execute the action → Respond: { status: "completed", ... }
       NO  → Respond: { status: "rejected", reason: "Human declined" }
  Timeout → Respond: { status: "timeout" }
```

### Building the Approval System

**Step 1: Create a second workflow - the approval endpoint**
- Webhook Trigger (GET): path `approve-action`
- Accepts query params: `execution_id`, `decision` (`approved` | `rejected`)
- Responds: `{ status: "received" }` (immediately)

This URL is embedded in the Slack buttons.

**Step 2: Slack message format**
```
:robot_face: *OpenClaw Action Requires Approval*

Action: Create HubSpot Deal
Details:
  Company: {{ $json.company }}
  Value: ${{ $json.value }}
  Stage: {{ $json.stage }}

<YOUR_N8N_URL/webhook/approve-action?execution_id={{ $execution.id }}&decision=approved|✅ Approve>
<YOUR_N8N_URL/webhook/approve-action?execution_id={{ $execution.id }}&decision=rejected|❌ Reject>

_Requested by OpenClaw - expires in 24 hours_
```

**Step 3: Wait node settings**
- Resume: `On Webhook Call`
- Webhook URL: the approval endpoint
- Limit Wait Time: ✓ enabled
- Amount: 24 hours

**Step 4: IF node + both outcome branches**
```
Condition: {{ $json.query.decision }} === "approved"
YES → your action (HubSpot, Airtable, HTTP, etc.) → Respond: { status: "completed" }
NO  → Respond: { status: "rejected", message: "Human declined this action" }
```

### Agent Response Handling (add to SOUL.md)

```markdown
### create_deal - n8n Tool (HITL enabled)
URL: https://YOUR-INSTANCE/webhook/create-deal
Method: POST
Payload: { company: string, value: number, stage: string }
Returns:
  - { status: "completed" } - deal created, share deal_id with user
  - { status: "rejected" }  - human declined, inform user, do not retry automatically
  - { status: "timeout" }   - approval expired in 24h, tell user to check Slack
  - { status: "error" }     - something failed, share error message
Note: Requires human approval via Slack. Inform the user this may take time.
```

### HITL as Trust Calibration

Start with HITL on every high-stakes workflow. Review execution logs. When you see the agent consistently making correct decisions on a workflow, remove the HITL gate - the history is your evidence. This is how you calibrate trust with AI agents in a business environment.

---

## Skill 3: Cron-Based Business Automation (n8n Orchestrates, Agent Reasons)

### The Pattern Inversion

Most people think: **agent calls n8n**.
This skill inverts it: **n8n calls agent**.

For scheduled automation, n8n's Cron trigger is the reliable orchestrator. OpenClaw handles one specific step - the judgment, scoring, or classification - and returns a structured result. n8n routes based on that result.

```
n8n Cron (9am daily)
  └─ Fetch new contacts (HubSpot / Airtable / Salesforce)
  └─ For each contact: HTTP Request → OpenClaw scoring endpoint
       Returns: { score: 85, action: "enroll_enterprise", reasoning: "..." }
  └─ IF score > 70: Instantly → enroll in enterprise sequence
  └─ IF score 40–70: add to nurture sequence
  └─ IF score < 40: HubSpot → mark Disqualified
  └─ Slack summary: "Daily: 12 enrolled, 8 nurture, 4 disqualified"
```

### Why This Is More Reliable Than Agent-Run Crons

| Aspect | Agent-run cron | n8n orchestrated cron |
|--------|---------------|----------------------|
| Timing reliability | Depends on agent uptime | n8n native scheduler |
| API call consistency | Non-deterministic | Deterministic nodes |
| Error handling | Agent decides how to handle | IF/Switch branches |
| Audit trail | LLM context | n8n execution logs |
| Retry on failure | Agent may loop | Manual retry from execution view |
| Non-technical oversight | Impossible | n8n execution dashboard |

### Configuring OpenClaw as an n8n Sub-Node

Add an `HTTP Request` node in n8n to call OpenClaw:
- Method: `POST`
- URL: OpenClaw's webhook endpoint
- Body:
  ```json
  {
    "task": "score_lead",
    "contact_email": "{{ $json.email }}",
    "company": "{{ $json.company }}",
    "source": "{{ $json.lead_source }}",
    "recent_activity": "{{ $json.last_activity_date }}"
  }
  ```
- Parse response as JSON

### Required: Fallback Handling

Always add a fallback for unexpected agent responses:

```javascript
// Code node after HTTP Request to OpenClaw
const { score, action } = $json;

if (typeof score !== 'number' || !action) {
  // Log the failure but don't break the batch
  return {
    score: null,
    action: 'manual_review',
    error: 'Invalid OpenClaw response',
    original: $json
  };
}

return { score, action };
```

Then route `action === 'manual_review'` to a Slack alert for human follow-up.

### Common Cron Automation Patterns

**Daily lead scoring and routing:**
```
Cron → Fetch leads (last 24h) → Score each via OpenClaw → Route by score → Slack summary
```

**Weekly pipeline health report:**
```
Cron → HubSpot deals query → Summarize via OpenClaw → Format as Slack message → Post to #sales
```

**Automated follow-up trigger:**
```
Cron → Fetch contacts with no activity in 7 days → OpenClaw: should we follow up? → If yes: Instantly enroll
```

**CRM data hygiene:**
```
Cron → Fetch incomplete contacts → OpenClaw: classify completeness → Flag for review in Airtable
```

**Sequence performance monitor:**
```
Cron → Instantly: fetch sequence stats → OpenClaw: analyze performance → Slack alert if reply rate drops
```

---

## Skill 4: Human-in-the-Loop for Cron Jobs

### Why Cron + HITL Is Powerful

Cron automation runs without anyone watching. HITL inserts a human checkpoint when an automated run encounters something unusual - a deal over a certain size, a contact that matches a VIP criteria, an action that has irreversible consequences.

### Pattern: Conditional HITL in Cron Workflows

```
Cron → Fetch leads → Score via OpenClaw
  └─ IF score > 90 AND deal_value > $50K:
       → Slack HITL: "High-value lead detected: {{ $json.company }}. Enroll?"
       → Wait for approval
       → If approved: enroll in VIP sequence
  └─ IF score > 70 (regular):
       → Automatically enroll in standard sequence
  └─ IF score < 40:
       → Mark disqualified
```

This gives you automation with a human override for the exceptions that matter most.

---

## Skill 5: AI Model Router

### What this solves

OpenClaw (Claude) is exceptional at reasoning and writing. But some tasks are better handled by other systems:
- Real-time web search → Grok (xAI)
- Private knowledge base queries → RAG system
- Image understanding → Vision models
- Compliance/legal review → Specialized fine-tuned models
- Data retrieval → Internal APIs or databases

Instead of giving OpenClaw all these API keys, build one n8n router webhook. One URL. n8n routes to the right endpoint based on `task_type`.

### Router Workflow

```
Webhook Trigger: POST { task_type, query, context? }
  └─ Switch node (route by task_type):
       "web_search"     → Grok API
       "knowledge_base" → RAG agent endpoint
       "image_analysis" → Vision model endpoint
       "data_lookup"    → Internal database API
       "legal_review"   → Compliance LLM endpoint
       default          → Respond: { error: "Unknown task_type" }
  └─ Code node: normalize all responses to unified schema
  └─ Respond: { status, result, model_used, latency_ms, task_type }
```

### Switch Node Configuration

| Rule | Condition | Route to |
|------|-----------|----------|
| Web search | `task_type == "web_search"` | Grok API HTTP Request |
| Knowledge base | `task_type == "knowledge_base"` | RAG endpoint HTTP Request |
| Image analysis | `task_type == "image_analysis"` | Vision model HTTP Request |
| Data lookup | `task_type == "data_lookup"` | Internal API HTTP Request |
| Fallback | default | Error response |

### OpenClaw Tool Definition

```markdown
### ai_router - n8n Tool
URL: https://YOUR-INSTANCE/webhook/ai-router
Method: POST
When to use: When you need capabilities not in your current context:
  - Real-time web data or current news
  - Company knowledge base lookup
  - Image or document analysis
  - Specialized domain knowledge (legal, compliance, technical)
Payload:
  - task_type: "web_search" | "knowledge_base" | "image_analysis" | "data_lookup" | "legal_review"
  - query: string - what you need to know
  - context: string - optional additional context for the sub-agent
Returns: { status, result, model_used, latency_ms }
Example: { "task_type": "web_search", "query": "latest n8n version changelog" }
```

### Adding New Models to the Router

1. Add a new case to the Switch node
2. Add an HTTP Request node for the new model/API
3. Connect to the response normalization Code node
4. Add the new `task_type` enum value to the OpenClaw tool definition

No other changes needed. This is the power of the router: **new AI capabilities without touching agent configuration**.

---

## Skill 6: Webhook Tool Configuration - The Complete Guide

### How to Build Any Webhook Tool

Follow this exact sequence for any tool you build:

**Step 1 - Create workflow**
- `+ New Workflow`
- Name: `[Tool] {Descriptive Name}` (the `[Tool]` prefix helps you find them)
- Tag: `agent-tools`

**Step 2 - Webhook Trigger**
```
HTTP Method: POST
Path: your-tool-name-kebab-case
Response Mode: "Using 'Respond to Webhook' Node"  ← REQUIRED
```
Test URL: `https://YOUR-INSTANCE/webhook-test/your-tool-name`
Production URL: `https://YOUR-INSTANCE/webhook/your-tool-name`

**Step 3 - Code node (validation - always)**
```javascript
// Validate every field the agent might send
const body = $json.body;

// Check required fields
if (!body.required_field) {
  throw new Error('Missing required field: required_field');
}

// Validate enums
const VALID_ACTIONS = ['create', 'read', 'update'];
if (body.action && !VALID_ACTIONS.includes(body.action)) {
  throw new Error(`Invalid action: "${body.action}". Must be: ${VALID_ACTIONS.join(', ')}`);
}

// Sanitize numbers
const limit = Math.min(Math.max(1, parseInt(body.limit) || 20), 100);

return { ...body, limit, _validated: true };
```

**Step 4 - Logic nodes**
Use stored credentials. Use `{{ $json.field_name }}` expressions to pass validated input to node parameters.

**Step 5 - Respond to Webhook**
```json
{
  "status": "success",
  "data": "{{ $json }}",
  "message": "Operation completed"
}
```

**Step 6 - Test**
```bash
# In n8n: click "Listen for Test Event" on Webhook Trigger node
n8n-agent webhooks test \
  --url https://YOUR-INSTANCE/webhook-test/your-tool-name \
  --payload '{ "your": "payload" }'
```

Watch nodes light up. Click each node to verify input/output.

**Step 7 - Activate**
Toggle workflow to Active. The production URL is now live.

**Step 8 - Add to OpenClaw SOUL.md**
Document: URL, when to use, payload schema, response schema, error handling notes.

### Payload Design Rules

| Rule | Reason |
|------|--------|
| Use enums for action types | Prevents the agent from sending arbitrary values |
| Keep payload narrow | Fewer fields = smaller influence surface |
| Always validate in Code node | Catches malformed input before it reaches APIs |
| Never accept raw SQL, formulas, or query strings | Injection prevention |
| Document the schema precisely | Agent needs exact field names and types |
| Always return `status` field | Agent error handling depends on it |

### Standard Response Schema

Design every workflow to return this:

```json
{
  "status": "success" | "error" | "rejected" | "timeout" | "pending_approval",
  "data": {},
  "message": "Human-readable description",
  "count": 0,
  "timestamp": "ISO 8601",
  "execution_id": "optional - helps with debugging"
}
```

### Agent Error Handling Guide

Add these behaviors to OpenClaw's SOUL.md:

```markdown
## n8n Webhook Tool Error Handling

When a webhook tool returns:
- status "success" - use the data, respond to user normally
- status "error" - describe the error to the user; if it sounds transient (timeout, rate limit),
  offer to retry once; if it's a validation error, correct the payload
- status "rejected" - a human declined the action; inform user, do not retry automatically
- status "timeout" - approval window expired; tell user to check n8n or Slack
- status "pending_approval" - action is awaiting human approval; inform user it may take time
- HTTP error (non-200) - the workflow itself failed; suggest user check n8n execution logs
```

---

## Skill 7: Multi-Environment Management

### Managing Multiple n8n Instances

Use named instances to manage dev/staging/production environments:

```bash
# Connect dev instance
n8n-agent instance connect \
  --url https://dev-instance.app.n8n.cloud \
  --api-key DEV_KEY \
  --name dev

# Connect production instance
n8n-agent instance connect \
  --url https://prod-instance.app.n8n.cloud \
  --api-key PROD_KEY \
  --name prod \
  --set-default
```

### Workflow Promotion (Dev → Production)

```bash
# Export a workflow from dev
n8n-agent workflows get --id WORKFLOW_ID > my-workflow.json

# Review and edit the JSON if needed (update credential IDs, etc.)
# Then import in n8n UI: Workflows → Import from file
```

### Per-Client n8n Instances

For agency work or multi-client OpenClaw deployments, each client has their own n8n instance:

```bash
n8n-agent instance connect --url CLIENT_URL --api-key CLIENT_KEY --name acme-corp
```

The agent's SOUL.md references webhook URLs for that client's instance. Switching to another client is a SOUL.md swap - no CLI reconfiguration.

---

## Skill 8: Execution Monitoring and Debugging

### Reading Execution History

```bash
# All recent executions
n8n-agent executions list --limit 30

# Filter by workflow
n8n-agent executions list --workflow-id WF_ID --limit 20

# Find all failures
n8n-agent executions list --status error --limit 50

# Find HITL waiting for approval
n8n-agent executions list --status waiting

# Full node-level trace
n8n-agent executions get --id EXECUTION_ID
```

### Execution Status Reference

| Status | Meaning | Action |
|--------|---------|--------|
| `success` | Completed normally | Review output if unexpected |
| `error` | A node failed | Check which node, fix workflow or credential |
| `waiting` | HITL paused, awaiting approval | Check Slack notification |
| `running` | Currently executing | Wait |
| `canceled` | Stopped manually | Re-trigger if needed |

### Common Failures and Fixes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Error on Code node | Validation failed - agent sent bad payload | Check agent's SOUL.md payload schema |
| Error on CRM node | Credential expired | Refresh in `Settings → Credentials` |
| Error on HTTP Request | External API down or rate limited | Add retry logic or wait |
| Stuck on "Waiting" | HITL gate awaiting human | Check Slack for approval notification |
| Empty data returned | Workflow logic issue | Trace node-by-node in execution view |
| 200 response but wrong format | Respond to Webhook expression error | Check the responseBody expression |

### Retrying Failed Executions

In the n8n UI:
1. `Executions` → click the failed execution
2. Click `Retry` (top right)
3. Workflow re-runs with the original input

No need to re-trigger from the agent. The retry runs the exact same payload that failed.

### Setting Up Failure Alerts

Add an `Error Trigger` workflow that fires on any execution failure:

```
Error Trigger node
  └─ Slack: ":red_circle: *n8n Tool Failed*
             Workflow: {{ $workflow.name }}
             Error: {{ $execution.lastError.message }}
             View: YOUR_N8N_URL/executions/{{ $execution.id }}"
```

---

## Skill 9: Credential Vault Management

### Viewing What's in the Vault

```bash
n8n-agent credentials list
```

Returns: credential name, type, creation date. Never returns values.

### Supported Credential Types (n8n built-in)

n8n supports 400+ credential types including:
- `airtableTokenApi` - Airtable Personal Access Token
- `hubspotAppToken` - HubSpot Private App token
- `salesforceOAuth2Api` - Salesforce OAuth
- `slackApi` - Slack Bot Token
- `openAiApi` - OpenAI API key
- `anthropicApi` - Anthropic API key
- `googleSheetsOAuth2Api` - Google Sheets
- `stripeApi` - Stripe secret key
- `httpBasicAuth` - Basic auth for any HTTP endpoint
- `httpHeaderAuth` - Header-based auth (Bearer, API key)

### Naming Convention

Use a clear naming pattern so workflows self-document:

```
{Service} - {Environment} - {Purpose}
Examples:
  Airtable - Prod - Leads Database
  HubSpot - Client: Acme Corp
  Slack - Agent Notifications
  Stripe - Staging - Billing
```

---

## Skill 10: n8n Instance Setup and Configuration

### Cloud (Fastest Start)

1. Sign up at [n8n.io](https://n8n.io) - free tier available
2. Your webhook base URL: `https://YOUR-SUBDOMAIN.app.n8n.cloud`
3. API key: `Settings → n8n API → Create an API key`

### Self-Hosted (Production)

```bash
# Docker Compose - minimal setup
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_ENCRYPTION_KEY=your-32-char-random-key
      - N8N_HOST=your-domain.com
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://your-domain.com/
    volumes:
      - ~/.n8n:/home/node/.n8n
EOF
docker compose up -d
```

### Connect CLI to Your Instance

```bash
# Environment variables (CI / agent server environments)
export N8N_URL=https://YOUR-INSTANCE.app.n8n.cloud
export N8N_API_KEY=your-api-key

# Or saved config (local dev)
n8n-agent instance connect \
  --url https://YOUR-INSTANCE.app.n8n.cloud \
  --api-key your-api-key
```

---

## MCP Tool Reference for OpenClaw

When connected via MCP, OpenClaw has access to all of these tools:

| Tool name | What it does | When to use |
|-----------|-------------|-------------|
| `webhook_trigger` | **Core tool** - POST payload to n8n, receive result synchronously | Any time the agent needs to call a CRM, send data, or trigger any locked workflow |
| `webhook_test` | Same but targets test URL | During workflow development/testing |
| `workflow_list` | List all workflows with status | When agent needs to know what tools are available |
| `workflow_get` | Get full workflow JSON + config | When debugging or reviewing a workflow |
| `workflow_activate` | Enable a workflow | When deploying a new tool |
| `workflow_deactivate` | Disable a workflow | When taking a tool offline |
| `workflow_delete` | Remove a workflow | Cleanup only - confirm with user |
| `execution_list` | Recent execution history | When debugging a failed tool call |
| `execution_get` | Full node-level trace | When diagnosing exactly what went wrong |
| `execution_delete` | Remove an execution record | Log cleanup |
| `credential_list` | Inventory of vault contents (names only) | When checking if a credential exists |
| `credential_delete` | Remove a credential | Cleanup only - confirm with user |
| `instance_connect` | Add a new n8n instance | Initial setup or adding client instances |
| `instance_health` | Check instance reachability | Before any operation, or when debugging connectivity |

### Most Important: `webhook_trigger`

This is the tool that enables the zero-trust pattern. When a user asks the agent to do something that involves external APIs (read a CRM, send an email, query a database), the agent should call `webhook_trigger` with the appropriate URL and payload - not attempt to access the API directly.

```
Tool: webhook_trigger
Input: {
  url: "https://YOUR-INSTANCE/webhook/query-leads",
  payload: { "status": "Open", "limit": 10 }
}
Output: { status: "success", data: [...], count: 10 }
```

---

## Payload Security Reference

### What agents can and cannot do via webhook payloads

| CAN do | CANNOT do |
|--------|-----------|
| Pass allowed enum values | Use arbitrary strings for action types |
| Control query parameters within defined ranges | Exceed maximum record counts |
| Specify which record to update by ID | Access tables not in the workflow |
| Trigger different workflow paths via boolean flags | Modify the workflow logic itself |
| Pass text content for CRM notes/fields | Inject formulas or query language |

### Injection Prevention

Never design a workflow that passes agent-provided strings directly to:
- Airtable formula expressions
- SQL queries
- n8n expressions that execute as code
- API endpoint URLs

Always use the agent input as a **value** that gets inserted into a pre-defined template, never as **logic** that determines what happens.

---

## Security Deployment Checklist

Before any n8n webhook tool goes into production:

- [ ] All API keys in n8n credential vault (never in workflow code, env vars, or payloads)
- [ ] Webhook URL uses HTTPS
- [ ] Payload validated in Code node before reaching any API call
- [ ] Action parameters use enums - no free-form strings for operation type
- [ ] Operation is scoped to minimum necessary (no "query any table" handlers)
- [ ] HITL gate added for all create/update/delete operations in production systems
- [ ] HITL timeout configured (max 24h) with graceful timeout response
- [ ] Failure alert workflow configured (Error Trigger → Slack)
- [ ] Webhook URL not committed to any public repository
- [ ] Execution logs reviewed after first production run
- [ ] Fallback path exists in every IF/Switch branch

---

## Glossary

| Term | Definition |
|------|-----------|
| **Webhook Trigger** | n8n node that starts a workflow when an HTTP POST arrives. Has a unique URL per workflow. |
| **Respond to Webhook** | n8n node that sends the HTTP response back to the caller. Enables synchronous tool calls. |
| **Test webhook URL** | Active only while clicking "Listen for Test Event". Safe for development. Contains `/webhook-test/`. |
| **Production webhook URL** | Always active when workflow is enabled. Contains `/webhook/`. |
| **Wait node** | Pauses a workflow until a separate signal arrives. Core of HITL pattern. |
| **Credential Vault** | n8n's encrypted storage for API keys and OAuth tokens. Values never visible to agents. |
| **Execution** | One complete run of a workflow. Logged with full input/output at every node. |
| **Active workflow** | A workflow currently listening for triggers. Must be activated before it responds. |
| **HITL** | Human-in-the-loop. A human approval step inserted into a workflow before a sensitive action. |
| **Webhook-as-Tool** | The pattern of using a webhook URL as a scoped, auditable proxy for API access. |
| **Zero-trust tool** | A tool where the agent has no credentials - only a webhook URL that proxies to secured systems. |
| **Cron inversion** | Pattern where n8n orchestrates and calls OpenClaw as a sub-step, rather than the reverse. |
| **AI router** | n8n Switch node that routes agent calls to different AI models based on task type. |

---

*Skill maintained in: [n8n-agent-cli](https://github.com/bcharleson/n8n-agent-cli) | npm: [n8n-agent-cli](https://npmjs.com/package/n8n-agent-cli)*
*Version: 0.1.0 | Updated: 2026-03-20*
