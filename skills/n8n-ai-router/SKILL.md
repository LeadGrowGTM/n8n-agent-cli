# Skill: n8n-ai-router

> **Route agent tool calls to specialized AI models via n8n Switch node**
> Use this skill to build a multi-model AI system where OpenClaw calls one webhook
> and n8n routes to the appropriate specialized model (Claude, Grok, RAG, vision, etc.)

## Install

```bash
npx n8n-agent-cli skills install n8n-ai-router
```

## Why This Matters

OpenClaw (Claude) is exceptional at reasoning, writing, and conversation. But there are tasks where a different model or system is better:
- Real-time web search → Grok (xAI)
- Private knowledge base queries → RAG agent (Pinecone + Claude)
- Image analysis → Vision model
- Compliance/legal review → Specialized fine-tuned model
- Data retrieval → Internal API or database query tool

Rather than giving OpenClaw API keys to all of these, build one n8n "router" webhook. OpenClaw calls it with a `task_type`. n8n routes to the right endpoint.

## n8n Router Workflow

```
Webhook Trigger: POST { task_type, query, context? }
  └─ Switch node (route by task_type):
       "web_search"     → HTTP Request → Grok API
       "knowledge_base" → HTTP Request → RAG Agent endpoint
       "image_analysis" → HTTP Request → Vision model endpoint
       "data_lookup"    → HTTP Request → Internal database API
       default          → HTTP Request → OpenClaw general endpoint
  └─ Respond to Webhook: unified response
       { status, result, model_used, latency_ms }
```

## OpenClaw Tool Definition

```markdown
### ai_router — n8n Tool
URL: https://YOUR-INSTANCE/webhook/ai-router
Method: POST
When to use: When you need capabilities outside your current context window —
             real-time data, knowledge base lookup, image analysis, or specialized AI
Payload:
  - task_type: "web_search" | "knowledge_base" | "image_analysis" | "data_lookup"
  - query: string (what you need to know or analyze)
  - context: string (optional — additional context for the sub-agent)
Returns: { status, result, model_used, latency_ms }
Example: { "task_type": "web_search", "query": "latest n8n version release notes" }
```

## Switch Node Configuration

In the Switch node, add one output per task type:
| Rule | Output |
|------|--------|
| `{{ $json.body.task_type }}` === `"web_search"` | Route 1 |
| `{{ $json.body.task_type }}` === `"knowledge_base"` | Route 2 |
| `{{ $json.body.task_type }}` === `"image_analysis"` | Route 3 |
| Fallback | Route 4 (error or default) |

## HTTP Request Node per Route

### Grok web search

```
URL: https://api.x.ai/v1/chat/completions
Method: POST
Headers: { Authorization: Bearer {{ $credentials.grokApiKey }} }
Body:
{
  "model": "grok-3",
  "messages": [
    { "role": "system", "content": "Search the web and answer precisely." },
    { "role": "user", "content": "{{ $json.body.query }}" }
  ]
}
```

### RAG agent (Pinecone + Claude)

```
URL: https://your-rag-agent.vercel.app/api/query
Method: POST
Body:
{
  "query": "{{ $json.body.query }}",
  "namespace": "company-knowledge",
  "top_k": 5
}
```

### Unified response formatter (Code node before Respond to Webhook)

```javascript
const result = $json;  // response from whichever route ran
return {
  status: 'success',
  result: result.answer || result.choices?.[0]?.message?.content || result.data,
  model_used: result.model || 'unknown',
  latency_ms: Date.now() - $execution.startedAt,
  task_type: $('Webhook Trigger').first().json.body.task_type
};
```

## Adding a New Model to the Router

1. Add a new rule to the Switch node
2. Add a new `HTTP Request` node for the model's API
3. Connect to the response formatter Code node
4. No changes needed to OpenClaw's tool definition — just a new enum value in `task_type`

This is the power of the router pattern: **new AI capabilities without reconfiguring the agent**.

## Testing

```bash
# Test web search routing
n8n-agent webhook test \
  --url https://YOUR-INSTANCE/webhook-test/ai-router \
  --payload '{ "task_type": "web_search", "query": "n8n latest release" }'

# Test knowledge base routing
n8n-agent webhook test \
  --url https://YOUR-INSTANCE/webhook-test/ai-router \
  --payload '{ "task_type": "knowledge_base", "query": "What is our refund policy?" }'
```
