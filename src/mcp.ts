#!/usr/bin/env node
// MCP entry point — one line, just like all your other tools
import { startMcpServer } from './mcp/server.js';
startMcpServer().catch(console.error);
