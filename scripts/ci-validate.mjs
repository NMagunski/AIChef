import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { mockCIEnvironment } from './ci-env.mjs';
import { validationSummary, summaryMarkdown } from './ci-summary.mjs';
mkdirSync('ci-reports', { recursive: true });
const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'validate'], { env: mockCIEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => { process.stdout.write(data); log += data.toString(); });
child.on('error', () => { process.exitCode = 1; });
child.on('close', (code) => {
  const result = validationSummary(log, code ?? 1), markdown = summaryMarkdown(result);
  writeFileSync('ci-reports/results.json', JSON.stringify(result, null, 2));
  writeFileSync('ci-reports/summary.md', markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
