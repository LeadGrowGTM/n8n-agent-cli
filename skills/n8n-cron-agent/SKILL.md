# Skill: n8n-cron-agent

> **n8n as orchestrator, OpenClaw as reasoning node**
> Use this skill when you need reliable scheduled automation (daily jobs, syncs,
> triggers) where n8n handles execution and OpenClaw handles judgment.

## Install

```bash
npx n8n-agent-cli skills install n8n-cron-agent
```

## The Pattern Inversion

Standard pattern: Agent → calls n8n webhook tool
This skill: n8n Cron trigger → calls OpenClaw webhook → routes based on result

**Why this matters:** Cron timing, API calls, and routing are all deterministic (n8n). OpenClaw handles only the judgment step (scoring, summarizing, deciding). Every run is logged. Failures are isolated. Retries are manual and auditable.

## Typical Use Cases

- Daily lead scoring and CRM routing
- Weekly pipeline health reports sent to Slack
- Automated outreach trigger based on CRM state changes
- Periodic data sync between two platforms
- Any "if X then Y" automation that needs to run reliably on a schedule

## n8n Workflow Pattern

```
Cron Trigger (9am daily)
  └─ HubSpot/Airtable: fetch records (last 24h)
  └─ Split In Batches: process each record
  └─ HTTP Request → OpenClaw endpoint:
       POST { record_data }
       Returns { score, action, reasoning }
  └─ IF: score > 70?
       YES → Instantly: enroll in sequence
       NO  → HubSpot: mark as Disqualified
  └─ Aggregate results
  └─ Slack: "Daily summary: X qualified, Y disqualified, Z skipped"
```

## Configuring the OpenClaw Node in n8n

Add an `HTTP Request` node with:
- **Method:** POST
- **URL:** Your OpenClaw webhook endpoint
- **Body (JSON):**
  ```json
  {
    "task": "score_lead",
    "contact": "{{ $json.email }}",
    "company": "{{ $json.company }}",
    "activity": "{{ $json.last_activity }}",
    "source": "{{ $json.source }}"
  }
  ```
- **Response:** Parse as JSON

## OpenClaw Endpoint Format

Your OpenClaw instance needs a webhook that accepts the scoring payload and returns:

```json
{
  "score": 85,
  "action": "enroll_enterprise",
  "reasoning": "High ACV company, recent demo activity, ICP match",
  "confidence": "high"
}
```

## Fallback Handling (Required)

Always add a fallback for when OpenClaw's response is unexpected:

```
IF node: $json.score is a number AND $json.action exists?
YES → route normally
NO  → Slack: "Scoring failed for {{ $json.email }} — manual review needed"
     → HubSpot: add to "Review" list
```

This prevents one bad OpenClaw response from silently breaking the entire batch.

## Monitoring Cron Runs

```bash
# See all cron executions for a workflow
n8n-agent executions list --workflow-name "Daily Lead Scoring" --limit 30

# Check for failures in the last 7 days
n8n-agent executions list --status error --limit 50

# Get details on a specific run
n8n-agent executions get --id EXECUTION_ID
```

## Alerting on Failures

Add this at the end of your workflow (after the main logic):

```
Error Trigger node → Slack: ":red_circle: Cron workflow failed
Workflow: {{ $workflow.name }}
Error: {{ $execution.lastError.message }}
Execution: https://your-n8n.com/executions/{{ $execution.id }}"
```

This ensures you're notified of any failure without needing to manually monitor n8n.
