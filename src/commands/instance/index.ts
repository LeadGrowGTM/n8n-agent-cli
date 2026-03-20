import { z } from 'zod';
import { saveInstance } from '../../core/config.js';
import type { CommandDefinition } from '../../core/types.js';

export const instanceCommands: CommandDefinition[] = [
  {
    name: 'instance_connect',
    group: 'instance',
    subcommand: 'connect',
    description: 'Connect to an n8n instance and verify the API key. Stores the connection for future use.',
    inputSchema: z.object({
      url: z.string().describe('n8n instance URL (e.g. https://myinstance.app.n8n.cloud)'),
      api_key: z.string().describe('n8n API key (Settings → API → Create API key)'),
      name: z.string().optional().describe('Alias for this instance (default: "default")'),
      set_default: z.boolean().optional().describe('Set as the default instance'),
    }),
    cliOptions: [
      { flag: '--url <url>', description: 'n8n instance URL', required: true },
      { flag: '--api-key <key>', description: 'n8n API key', required: true },
      { flag: '--name <name>', description: 'Instance alias (default: "default")' },
      { flag: '--set-default', description: 'Set as default instance' },
    ],
    handler: async (input, client) => {
      // Verify connection
      const health = await client.healthCheck();
      // Save to config
      saveInstance({
        name: input.name ?? 'default',
        url: input.url,
        apiKey: input.api_key,
        isDefault: input.set_default ?? true,
      });
      return {
        status: 'connected',
        instance: input.url,
        n8n_version: (health as any).version ?? 'unknown',
        message: `Connected to n8n at ${input.url}`,
      };
    },
  },

  {
    name: 'instance_health',
    group: 'instance',
    subcommand: 'health',
    description: 'Check if the configured n8n instance is reachable and responding.',
    inputSchema: z.object({
      instance: z.string().optional().describe('Instance name (uses default if omitted)'),
    }),
    handler: async (_input, client) => {
      const health = await client.healthCheck();
      return { status: 'ok', ...health };
    },
  },
];
