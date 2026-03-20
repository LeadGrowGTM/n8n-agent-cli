// Output formatting — JSON (MCP / piped) vs pretty (human CLI)

export type OutputMode = 'pretty' | 'json' | 'quiet';

export function detectMode(): OutputMode {
  if (process.env.N8N_AGENT_JSON === '1') return 'json';
  if (!process.stdout.isTTY) return 'json';
  return 'pretty';
}

export function printResult(data: unknown, mode: OutputMode = detectMode()): void {
  if (mode === 'json') {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (mode === 'quiet') return;
  console.log(JSON.stringify(data, null, 2));
}

export function printSuccess(message: string, mode: OutputMode = detectMode()): void {
  if (mode === 'quiet') return;
  if (mode === 'json') {
    console.log(JSON.stringify({ status: 'success', message }));
    return;
  }
  console.log(`✓ ${message}`);
}

export function printError(message: string, mode: OutputMode = detectMode()): void {
  if (mode === 'json') {
    console.error(JSON.stringify({ status: 'error', message }));
    return;
  }
  console.error(`✗ ${message}`);
}

export function printTable(
  rows: Record<string, any>[],
  columns: string[],
  mode: OutputMode = detectMode()
): void {
  if (mode === 'json') {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log('(no results)');
    return;
  }

  // Simple columnar output — no heavy dependencies
  const widths = columns.map((col) =>
    Math.max(col.length, ...rows.map((r) => String(r[col] ?? '').length))
  );

  const header = columns.map((col, i) => col.padEnd(widths[i])).join('  ');
  const divider = widths.map((w) => '─'.repeat(w)).join('  ');

  console.log(header);
  console.log(divider);
  for (const row of rows) {
    console.log(columns.map((col, i) => String(row[col] ?? '').padEnd(widths[i])).join('  '));
  }
}
