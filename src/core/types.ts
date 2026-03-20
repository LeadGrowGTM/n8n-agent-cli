import { z } from 'zod';

// ─── Command Definition (single source of truth for CLI + MCP) ───────────────

export interface CommandDefinition {
  name: string;                     // MCP tool name: "workflow_list"
  group: string;                    // CLI group: "workflows"
  subcommand: string;               // CLI subcommand: "list"
  description: string;              // Used by both CLI help and MCP
  inputSchema: z.ZodObject<any>;    // Zod schema — extract .shape for MCP
  cliOptions?: CliOption[];         // Commander.js flag definitions
  handler: (input: any, client: N8nClient) => Promise<any>;
}

export interface CliOption {
  flag: string;         // e.g. "-w, --workflow-id <id>"
  description: string;
  required?: boolean;
}

// ─── n8n API Types ────────────────────────────────────────────────────────────

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: N8nTag[];
  nodes?: N8nNode[];
  connections?: Record<string, any>;
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: 'manual' | 'trigger' | 'webhook' | 'cli';
  startedAt: string;
  stoppedAt?: string;
  status: 'success' | 'error' | 'waiting' | 'running' | 'canceled';
  data?: {
    resultData?: {
      runData?: Record<string, any[]>;
      error?: { message: string; stack?: string };
    };
  };
}

export interface N8nCredential {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface N8nNode {
  name: string;
  type: string;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, { id: string; name: string }>;
}

export interface N8nTag {
  id: string;
  name: string;
}

export interface N8nVariable {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'secret';
}

export interface N8nHealthStatus {
  status: 'ok' | 'error';
  version?: string;
}

// ─── Webhook Tool Types ───────────────────────────────────────────────────────

export interface WebhookToolResult {
  status: 'success' | 'error' | 'rejected' | 'timeout' | 'pending_approval';
  data?: any;
  message: string;
  execution_id?: string;
  timestamp: string;
}

export interface WebhookCallOptions {
  url: string;
  payload: Record<string, any>;
  timeoutMs?: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface N8nInstanceConfig {
  name: string;
  url: string;          // e.g. https://my-instance.app.n8n.cloud
  apiKey: string;
  isDefault?: boolean;
}

export interface CliConfig {
  instances: N8nInstanceConfig[];
  defaultInstance?: string;
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export class N8nError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'N8nError';
  }
}

export class AuthError extends N8nError {
  constructor(message = 'Invalid or missing n8n API key') {
    super(message, 401);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends N8nError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends N8nError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

// ─── Re-export for convenience ────────────────────────────────────────────────

export type { N8nClient } from './client.js';
