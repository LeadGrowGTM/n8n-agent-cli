import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';

export const workflowCommands: CommandDefinition[] = [
  {
    name: 'workflow_list',
    group: 'workflows',
    subcommand: 'list',
    description: 'List all workflows in the n8n instance. Filter by active status or tags.',
    inputSchema: z.object({
      active: z.boolean().optional().describe('Filter to only active (true) or inactive (false) workflows'),
      tags: z.string().optional().describe('Filter by tag name (e.g. "agent-tools")'),
      limit: z.number().optional().describe('Max number of workflows to return (default 100)'),
    }),
    handler: async (input, client) => {
      const workflows = await client.listWorkflows(input);
      return {
        workflows: workflows.map((w) => ({
          id: w.id,
          name: w.name,
          active: w.active,
          tags: w.tags?.map((t) => t.name) ?? [],
          updated: w.updatedAt,
        })),
        count: workflows.length,
      };
    },
  },

  {
    name: 'workflow_get',
    group: 'workflows',
    subcommand: 'get',
    description: 'Get full details of a workflow including its node graph and configuration.',
    inputSchema: z.object({
      id: z.string().describe('Workflow ID'),
    }),
    handler: async (input, client) => {
      return client.getWorkflow(input.id);
    },
  },

  {
    name: 'workflow_activate',
    group: 'workflows',
    subcommand: 'activate',
    description: 'Activate a workflow so it responds to triggers (webhooks, crons, etc.).',
    inputSchema: z.object({
      id: z.string().describe('Workflow ID to activate'),
    }),
    handler: async (input, client) => {
      const workflow = await client.activateWorkflow(input.id);
      return {
        status: 'activated',
        id: workflow.id,
        name: workflow.name,
        message: `Workflow "${workflow.name}" is now active`,
      };
    },
  },

  {
    name: 'workflow_deactivate',
    group: 'workflows',
    subcommand: 'deactivate',
    description: 'Deactivate a workflow so it stops responding to triggers.',
    inputSchema: z.object({
      id: z.string().describe('Workflow ID to deactivate'),
    }),
    handler: async (input, client) => {
      const workflow = await client.deactivateWorkflow(input.id);
      return {
        status: 'deactivated',
        id: workflow.id,
        name: workflow.name,
        message: `Workflow "${workflow.name}" is now inactive`,
      };
    },
  },

  {
    name: 'workflow_delete',
    group: 'workflows',
    subcommand: 'delete',
    description: 'Delete a workflow permanently. This cannot be undone.',
    inputSchema: z.object({
      id: z.string().describe('Workflow ID to delete'),
    }),
    handler: async (input, client) => {
      await client.deleteWorkflow(input.id);
      return { status: 'deleted', id: input.id };
    },
  },
];
