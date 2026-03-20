import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CliConfig, N8nInstanceConfig } from './types.js';

const CONFIG_DIR = join(homedir(), '.n8n-agent');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

export function readConfig(): CliConfig {
  ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) return { instances: [] };
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as CliConfig;
  } catch {
    return { instances: [] };
  }
}

export function writeConfig(config: CliConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

export function getDefaultInstance(): N8nInstanceConfig | null {
  // 1. Check environment variables first (for CI / agent environments)
  const envUrl = process.env.N8N_URL;
  const envKey = process.env.N8N_API_KEY;
  if (envUrl && envKey) {
    return { name: 'env', url: envUrl, apiKey: envKey, isDefault: true };
  }

  // 2. Fall back to saved config
  const config = readConfig();
  if (config.instances.length === 0) return null;

  const defaultInst = config.instances.find((i) => i.isDefault);
  return defaultInst ?? config.instances[0];
}

export function saveInstance(instance: N8nInstanceConfig): void {
  const config = readConfig();

  // If marked as default, clear existing defaults
  if (instance.isDefault) {
    config.instances = config.instances.map((i) => ({ ...i, isDefault: false }));
  }

  const existing = config.instances.findIndex((i) => i.name === instance.name);
  if (existing >= 0) {
    config.instances[existing] = instance;
  } else {
    config.instances.push(instance);
    // Auto-set as default if it's the first instance
    if (config.instances.length === 1) instance.isDefault = true;
  }

  writeConfig(config);
}

export function resolveInstance(name?: string): N8nInstanceConfig {
  if (name) {
    const config = readConfig();
    const inst = config.instances.find((i) => i.name === name);
    if (!inst) throw new Error(`Instance "${name}" not found. Run: n8n-agent connect`);
    return inst;
  }

  const inst = getDefaultInstance();
  if (!inst) {
    throw new Error(
      'No n8n instance configured.\n' +
        'Run: n8n-agent connect --url https://YOUR-INSTANCE.app.n8n.cloud --api-key YOUR_KEY\n' +
        'Or set N8N_URL and N8N_API_KEY environment variables.'
    );
  }
  return inst;
}
