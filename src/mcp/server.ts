import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { N8nClient } from '../core/client.js';
import { resolveInstance } from '../core/config.js';
import { ALL_COMMANDS } from '../commands/index.js';

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'n8n-agent',
    version: '0.1.0',
  });

  // Resolve the n8n instance at startup
  const instance = resolveInstance();
  const client = new N8nClient(instance.url, instance.apiKey);

  // Register every CommandDefinition as an MCP tool — single source of truth
  for (const cmd of ALL_COMMANDS) {
    server.tool(
      cmd.name,
      cmd.description,
      cmd.inputSchema.shape,
      async (input: any) => {
        try {
          const result = await cmd.handler(input, client);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
            isError: true,
          };
        }
      }
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
