# Skill: n8n-crm-query

> **Zero-trust CRM access via n8n webhook tools**
> Use this skill to query or write to any CRM (Airtable, HubSpot, Salesforce, Notion)
> through a scoped n8n webhook — without exposing API keys to the agent.

## Install

```bash
npx n8n-agent-cli skills install n8n-crm-query
```

## What This Skill Does

Guides the agent and operator to build n8n webhook tools that:
- Accept a narrow, validated payload from the agent
- Query or write to a CRM using stored credentials
- Return structured JSON synchronously via `Respond to Webhook`

The agent sends a POST. n8n runs the locked workflow. The agent gets data back.
No credential is ever exposed.

## Required n8n Setup

### Workflow structure

```
Webhook Trigger (POST, path: "crm-query")
  └─ Code node: validate payload
  └─ CRM node: Airtable | HubSpot | Salesforce (using stored credential)
  └─ Respond to Webhook: { status, data, count }
```

### Webhook Trigger settings

| Field | Value |
|-------|-------|
| HTTP Method | POST |
| Path | descriptive name (e.g. `query-leads`) |
| Response Mode | **Using 'Respond to Webhook' Node** |
| Authentication | None (or Basic Auth for production) |

### Payload validation (Code node — required)

```javascript
const { status, limit } = $json.body;
const validStatuses = ['Open', 'Qualified', 'Lost'];
if (!validStatuses.includes(status)) {
  throw new Error(`Invalid status. Must be: ${validStatuses.join(', ')}`);
}
return { status, limit: Math.min(limit || 20, 100) };
```

### Response shape (Respond to Webhook — required)

Always return this schema so the agent can handle it consistently:

```json
{
  "status": "success",
  "data": [],
  "count": 0,
  "message": "Found N records"
}
```

## OpenClaw Tool Definition

Add to SOUL.md:

```markdown
### query_leads — n8n Tool
URL: https://YOUR-INSTANCE.app.n8n.cloud/webhook/query-leads
Method: POST
When to use: User asks about leads, prospects, pipeline, or contact status
Payload:
  - status: "Open" | "Qualified" | "Lost"  (required)
  - limit: number 1-100 (optional, default 20)
Returns: { status, data: Lead[], count }
Security: API key managed in n8n credential vault. Never access Airtable directly.
```

## Test the webhook

```bash
# Test mode (while "Listen for Test Event" is active)
n8n-agent webhook test \
  --url https://YOUR-INSTANCE.app.n8n.cloud/webhook-test/query-leads \
  --payload '{ "status": "Open", "limit": 5 }'

# Or with curl
curl -X POST https://YOUR-INSTANCE.app.n8n.cloud/webhook-test/query-leads \
  -H "Content-Type: application/json" \
  -d '{ "status": "Open", "limit": 5 }'
```

## Audit the execution

```bash
n8n-agent executions list --workflow-name "[Tool] Query Leads"
n8n-agent executions get --id EXECUTION_ID
```
