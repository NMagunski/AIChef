import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
export function inspectContent(file, text, knownSecrets = []) {
  const findings = [];
  const patterns = [
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u],
    ['openai-key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/u],
    ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/u],
    ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u],
    ['serpapi-key', /(?:SERPAPI_API_KEY|api_key)["']?\s*[:=]\s*["'][a-fA-F0-9]{64}["']/u],
  ];
  for (const [rule, pattern] of patterns) { const match = pattern.exec(text); if (match) findings.push({ file, rule, line: text.slice(0, match.index).split('\n').length }); }
  if (knownSecrets.some((secret) => secret.length >= 12 && text.includes(secret))) findings.push({ file, rule: 'local-secret-copy', line: 0 });
  return findings;
}
export function scanRepository(root = process.cwd()) {
  const paths = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
  const privateValues = [];
  // Compare ignored local secrets in memory only; never return/log those values.
  for (const name of readdirSync(root).filter((name) => name.startsWith('.env') && name !== '.env.example')) {
    const path = resolve(root, name); if (!lstatSync(path).isFile()) continue;
    for (const match of readFileSync(path, 'utf8').matchAll(/^\s*(?:export\s+)?([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD))\s*=\s*(.*?)\s*$/gmu)) { const value = match[2].replace(/^(["'])(.*)\1$/u, '$2'); if (value.length >= 12) privateValues.push(value); }
  }
  const findings = [];
  for (const file of paths) {
    const path = resolve(root, file);
    if (relative(root, path).startsWith('..')) { findings.push({ file, rule: 'outside-workspace', line: 0 }); continue; }
    if (lstatSync(path).isSymbolicLink()) { findings.push({ file, rule: 'review-symlink', line: 0 }); continue; }
    if (/(?:^|\/)\.env(?:$|[.])/u.test(file) && file !== '.env.example') { findings.push({ file, rule: 'environment-file', line: 0 }); continue; }
    findings.push(...inspectContent(file, readFileSync(path, 'utf8'), privateValues));
  }
  return { files: paths.length, findings };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const result = scanRepository(); console.log(JSON.stringify({ scannedFiles: result.files, findings: result.findings })); if (result.findings.length) process.exitCode = 1; }
  catch { console.error('Secret scan could not complete; no files should be staged.'); process.exitCode = 1; }
}
