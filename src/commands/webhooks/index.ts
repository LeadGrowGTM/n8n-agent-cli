import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';

export const webhookCommands: CommandDefinition[] = [
  {
    name: 'webhook_trigger',
    group: 'webhooks',
    subcommand: 'trigger',
    description:
      'Trigger an n8n webhook and wait for the synchronous response. ' +
      'This is the core zero-trust tool call pattern — fire a payload, receive a result. ' +
      'Use this to call any n8n workflow configured with Webhook Trigger + Respond to Webhook.',
    inputSchema: z.object({
      url: z.string().describe('Full n8n webhook URL (production, not test)'),
      payload: z.record(z.any()).describe('JSON payload to send to the webhook'),
      timeout_ms: z.number().optional().describe('Timeout in ms (default 30000). For HITL workflows, use a longer timeout.'),
    }),
    handler: async (input, client) => {
      const result = await client.triggerWebhook(
        input.url,
        input.payload,
        input.timeout_ms ?? 30_000
      );
      return result;
    },
  },

  {
    name: 'webhook_test',
    group: 'webhooks',
    subcommand: 'test',
    description:
      'Send a test payload to an n8n test webhook URL. ' +
      'The workflow must be in "Listen for Test Event" mode in n8n first.',
    inputSchema: z.object({
      url: z.string().describe('n8n test webhook URL (contains /webhook-test/ in the path)'),
      payload: z.record(z.any()).describe('JSON payload to send'),
    }),
    handler: async (input, client) => {
      if (!input.url.includes('webhook-test') && !input.url.includes('-test')) {
        console.warn('Warning: URL does not appear to be a test webhook URL. Use webhook_trigger for production URLs.');
      }
      const result = await client.triggerWebhook(input.url, input.payload, 15_000);
      return result;
    },
  },
];
