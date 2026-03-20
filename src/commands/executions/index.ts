import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';

export const executionCommands: CommandDefinition[] = [
  {
    name: 'execution_list',
    group: 'executions',
    subcommand: 'list',
    description: 'List recent workflow executions. Filter by workflow ID, status, or limit.',
    inputSchema: z.object({
      workflow_id: z.string().optional().describe('Filter by workflow ID'),
      status: z.enum(['success', 'error', 'waiting', 'running', 'canceled']).optional().describe('Filter by execution status'),
      limit: z.number().optional().describe('Max executions to return (default 20)'),
    }),
    handler: async (input, client) => {
      const executions = await client.listExecutions({
        workflowId: input.workflow_id,
        status: input.status,
        limit: input.limit ?? 20,
      });
      return {
        executions: executions.map((e) => ({
          id: e.id,
          workflow_id: e.workflowId,
          status: e.status,
          mode: e.mode,
          started: e.startedAt,
          duration_ms: e.stoppedAt
            ? new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime()
            : null,
        })),
        count: executions.length,
      };
    },
  },

  {
    name: 'execution_get',
    group: 'executions',
    subcommand: 'get',
    description: 'Get full execution details including node-level input/output data and errors.',
    inputSchema: z.object({
      id: z.string().describe('Execution ID'),
    }),
    handler: async (input, client) => {
      const execution = await client.getExecution(input.id);
      // Surface the error clearly if present
      const error = execution.data?.resultData?.error;
      return {
        id: execution.id,
        workflow_id: execution.workflowId,
        status: execution.status,
        mode: execution.mode,
        started: execution.startedAt,
        stopped: execution.stoppedAt,
        error: error ? { message: error.message } : null,
        node_data: execution.data?.resultData?.runData ?? null,
      };
    },
  },

  {
    name: 'execution_delete',
    group: 'executions',
    subcommand: 'delete',
    description: 'Delete an execution record from n8n.',
    inputSchema: z.object({
      id: z.string().describe('Execution ID to delete'),
    }),
    handler: async (input, client) => {
      await client.deleteExecution(input.id);
      return { status: 'deleted', id: input.id };
    },
  },
];
