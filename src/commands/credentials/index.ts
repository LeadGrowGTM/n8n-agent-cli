import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';

export const credentialCommands: CommandDefinition[] = [
  {
    name: 'credential_list',
    group: 'credentials',
    subcommand: 'list',
    description:
      'List all credentials stored in the n8n vault. ' +
      'Returns credential names and types — never exposes actual key values. ' +
      'Use this to verify which credentials are available before building a workflow.',
    inputSchema: z.object({}),
    handler: async (_input, client) => {
      const credentials = await client.listCredentials();
      return {
        credentials: credentials.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          created: c.createdAt,
        })),
        count: credentials.length,
        note: 'Actual credential values are never returned by this command.',
      };
    },
  },

  {
    name: 'credential_delete',
    group: 'credentials',
    subcommand: 'delete',
    description: 'Delete a credential from the n8n vault by ID.',
    inputSchema: z.object({
      id: z.string().describe('Credential ID to delete'),
    }),
    handler: async (input, client) => {
      await client.deleteCredential(input.id);
      return { status: 'deleted', id: input.id };
    },
  },
];
