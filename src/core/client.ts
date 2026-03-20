import {
  AuthError,
  N8nError,
  NotFoundError,
  type N8nCredential,
  type N8nExecution,
  type N8nHealthStatus,
  type N8nVariable,
  type N8nWorkflow,
} from './types.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export class N8nClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    // Normalize: strip trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  // ─── Core fetch with retry + error handling ─────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestInit = {},
    retries = MAX_RETRIES
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = {
      'X-N8N-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { ...options, headers });

        if (res.status === 401) throw new AuthError();
        if (res.status === 404) throw new NotFoundError(path);
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
          if (attempt < retries) {
            await delay(retryAfter * 1000);
            continue;
          }
          throw new N8nError('Rate limited', 429);
        }

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new N8nError(`HTTP ${res.status}: ${body}`, res.status);
        }

        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      } catch (err) {
        lastError = err as Error;
        // Don't retry auth errors, not-found errors, or validation errors
        if (err instanceof AuthError || err instanceof NotFoundError) throw err;
        if (err instanceof N8nError && err.statusCode && err.statusCode < 500) throw err;
        // Retry server errors and network failures
        if (attempt < retries) {
          await delay(BASE_DELAY_MS * Math.pow(2, attempt));
        }
      }
    }

    throw lastError ?? new N8nError('Request failed after retries');
  }

  // ─── Health ──────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<N8nHealthStatus> {
    return this.request<N8nHealthStatus>('/health');
  }

  // ─── Workflows ───────────────────────────────────────────────────────────────

  async listWorkflows(params?: { active?: boolean; tags?: string; limit?: number }): Promise<N8nWorkflow[]> {
    const qs = new URLSearchParams();
    if (params?.active !== undefined) qs.set('active', String(params.active));
    if (params?.tags) qs.set('tags', params.tags);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs}` : '';
    const res = await this.request<{ data: N8nWorkflow[] }>(`/workflows${query}`);
    return res.data;
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    return this.request<N8nWorkflow>(`/workflows/${id}`);
  }

  async createWorkflow(workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    return this.request<N8nWorkflow>('/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  }

  async updateWorkflow(id: string, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    return this.request<N8nWorkflow>(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflow),
    });
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.request<void>(`/workflows/${id}`, { method: 'DELETE' });
  }

  async activateWorkflow(id: string): Promise<N8nWorkflow> {
    return this.request<N8nWorkflow>(`/workflows/${id}/activate`, { method: 'POST' });
  }

  async deactivateWorkflow(id: string): Promise<N8nWorkflow> {
    return this.request<N8nWorkflow>(`/workflows/${id}/deactivate`, { method: 'POST' });
  }

  // ─── Executions ──────────────────────────────────────────────────────────────

  async listExecutions(params?: {
    workflowId?: string;
    status?: string;
    limit?: number;
  }): Promise<N8nExecution[]> {
    const qs = new URLSearchParams();
    if (params?.workflowId) qs.set('workflowId', params.workflowId);
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs}` : '';
    const res = await this.request<{ data: N8nExecution[] }>(`/executions${query}`);
    return res.data;
  }

  async getExecution(id: string): Promise<N8nExecution> {
    return this.request<N8nExecution>(`/executions/${id}?includeData=true`);
  }

  async deleteExecution(id: string): Promise<void> {
    await this.request<void>(`/executions/${id}`, { method: 'DELETE' });
  }

  // ─── Credentials ─────────────────────────────────────────────────────────────

  async listCredentials(): Promise<N8nCredential[]> {
    const res = await this.request<{ data: N8nCredential[] }>('/credentials');
    return res.data;
  }

  async createCredential(credential: {
    name: string;
    type: string;
    data: Record<string, string>;
  }): Promise<N8nCredential> {
    return this.request<N8nCredential>('/credentials', {
      method: 'POST',
      body: JSON.stringify(credential),
    });
  }

  async deleteCredential(id: string): Promise<void> {
    await this.request<void>(`/credentials/${id}`, { method: 'DELETE' });
  }

  // ─── Variables ───────────────────────────────────────────────────────────────

  async listVariables(): Promise<N8nVariable[]> {
    const res = await this.request<{ data: N8nVariable[] }>('/variables');
    return res.data;
  }

  async createVariable(variable: Omit<N8nVariable, 'id'>): Promise<N8nVariable> {
    return this.request<N8nVariable>('/variables', {
      method: 'POST',
      body: JSON.stringify(variable),
    });
  }

  async deleteVariable(id: string): Promise<void> {
    await this.request<void>(`/variables/${id}`, { method: 'DELETE' });
  }

  // ─── Webhook trigger (fire and wait) ─────────────────────────────────────────

  async triggerWebhook(
    webhookUrl: string,
    payload: Record<string, any>,
    timeoutMs = 30_000
  ): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new N8nError(`Webhook returned HTTP ${res.status}: ${body}`);
      }

      return await res.json();
    } catch (err) {
      if ((err as any).name === 'AbortError') {
        throw new N8nError(`Webhook timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
