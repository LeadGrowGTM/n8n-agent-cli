# Skill: n8n-hitl-gate

> **Human-in-the-loop approval gates for AI agent tool calls**
> Use this skill to add a Slack (or email) approval step before any high-stakes
> n8n operation executes. The agent initiates — a human confirms.

## Install

```bash
npx n8n-agent-cli skills install n8n-hitl-gate
```

## When to Use

Add a HITL gate when the operation:
- Creates, updates, or deletes real CRM records
- Sends external communications (email, SMS, Slack)
- Moves money or affects billing
- Is irreversible or has significant business impact

## n8n Workflow Pattern

```
Webhook Trigger
  └─ Code node: validate payload
  └─ Slack: send approval request with [Approve] [Reject] links
  └─ Wait node: pause until approval webhook called (max 24h)
  └─ IF: decision === "approved"?
       YES → Execute the action
             └─ Respond to Webhook: { "status": "completed", ... }
       NO  → Respond to Webhook: { "status": "rejected", "reason": "Human declined" }
  └─ On timeout → Respond to Webhook: { "status": "timeout" }
```

## Step-by-Step Setup

### Step 1: Create the approval endpoint

Create a simple second n8n workflow:
- Webhook Trigger (GET): path `approve-action`
- Query params: `execution_id`, `decision` (`approved` | `rejected`)
- Respond immediately with: `{ "status": "received" }`

This is the URL embedded in the Slack buttons.

### Step 2: Slack notification node

```
Message: ":robot_face: *OpenClaw action requires approval*

Action: Create HubSpot Deal
Company: {{ $json.company }}
Value: ${{ $json.value }}

<https://your-n8n.com/webhook/approve-action?execution_id={{ $execution.id }}&decision=approved|✅ Approve>
<https://your-n8n.com/webhook/approve-action?execution_id={{ $execution.id }}&decision=rejected|❌ Reject>

_Expires in 24 hours_"
```

### Step 3: Wait node

- Type: `On Webhook Call`
- Webhook URL: your approval endpoint from Step 1
- Limit Wait Time: ✓ enabled
- Amount: 24 hours

### Step 4: IF node routing

```
Condition: {{ $json.decision }} === "approved"
YES → your action node → Respond: { "status": "completed" }
NO  → Respond: { "status": "rejected", "reason": "Human declined" }
```

## Agent Response Handling

The agent receives one of:

```json
{ "status": "completed", "data": {...}, "message": "Deal created: #12345" }
{ "status": "rejected", "message": "A human declined this action" }
{ "status": "timeout", "message": "No approval received within 24 hours. Action not taken." }
```

Add to SOUL.md to teach the agent how to handle each:

```markdown
### create_deal — n8n Tool (HITL enabled)
URL: https://YOUR-INSTANCE/webhook/create-deal
Method: POST
When to use: User wants to create a deal in HubSpot
Payload: { company: string, value: number, stage: string }
Returns:
  - status "completed": deal was created, include deal_id in response
  - status "rejected": human declined — inform user, do not retry
  - status "timeout": approval expired — tell user to check n8n or Slack
Note: This action requires human approval. It may take time before completing.
```

## Test the full HITL flow

```bash
# Trigger the webhook
n8n-agent webhook test \
  --url https://YOUR-INSTANCE/webhook-test/create-deal \
  --payload '{ "company": "Acme Corp", "value": 25000, "stage": "Proposal" }'

# Check execution status (should show "waiting")
n8n-agent executions list --status waiting

# Simulate approval (or click the Slack link)
curl "https://YOUR-INSTANCE/webhook/approve-action?execution_id=EX_ID&decision=approved"
```
