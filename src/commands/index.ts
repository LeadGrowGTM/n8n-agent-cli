import type { CommandDefinition } from '../core/types.js';
import { instanceCommands } from './instance/index.js';
import { workflowCommands } from './workflows/index.js';
import { executionCommands } from './executions/index.js';
import { webhookCommands } from './webhooks/index.js';
import { credentialCommands } from './credentials/index.js';

// Single registry — drives both CLI and MCP
export const ALL_COMMANDS: CommandDefinition[] = [
  ...instanceCommands,
  ...workflowCommands,
  ...executionCommands,
  ...webhookCommands,
  ...credentialCommands,
];
