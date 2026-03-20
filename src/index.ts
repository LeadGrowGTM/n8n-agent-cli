#!/usr/bin/env node
import { Command } from 'commander';
import { N8nClient } from './core/client.js';
import { resolveInstance } from './core/config.js';
import { printError, printResult } from './core/output.js';
import { ALL_COMMANDS } from './commands/index.js';

const program = new Command();

program
  .name('n8n-agent')
  .description(
    'AI agent CLI + MCP server for n8n\n' +
    'Zero-trust webhook tool platform for OpenClaw and other AI agents.'
  )
  .version('0.1.0');

// ─── Group commands by their CLI group ─────────────────────────────────────

const groups = new Map<string, Command>();

for (const cmd of ALL_COMMANDS) {
  // Ensure the group subcommand exists
  if (!groups.has(cmd.group)) {
    const groupCmd = program.command(cmd.group);
    groups.set(cmd.group, groupCmd);
  }
  const groupCmd = groups.get(cmd.group)!;

  // Build the subcommand
  const sub = groupCmd.command(cmd.subcommand).description(cmd.description);

  // Add CLI options
  for (const opt of cmd.cliOptions ?? []) {
    if (opt.required) {
      sub.requiredOption(opt.flag, opt.description);
    } else {
      sub.option(opt.flag, opt.description);
    }
  }

  // Action: resolve client + run handler
  sub.action(async (opts) => {
    try {
      const instance = resolveInstance(opts.instance);
      const client = new N8nClient(instance.url, instance.apiKey);

      // Normalize opts to match schema field names (kebab→snake)
      const input: Record<string, any> = {};
      for (const [k, v] of Object.entries(opts)) {
        input[k.replace(/-/g, '_')] = v;
      }

      const result = await cmd.handler(input, client);
      printResult(result);
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
}

// ─── MCP shortcut ───────────────────────────────────────────────────────────

program
  .command('mcp')
  .description('Start the MCP server (stdio transport — for use with OpenClaw / Claude Desktop)')
  .action(async () => {
    const { startMcpServer } = await import('./mcp/server.js');
    await startMcpServer();
  });

program.parse();
