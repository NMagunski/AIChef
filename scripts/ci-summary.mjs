const stages = ['scan:secrets', 'lint', 'typecheck', 'test:unit', 'test:api', 'build', 'test:e2e'];
export function validationSummary(log, exitCode) {
  const sections = stages.map((stage) => { const start = log.search(new RegExp(`^> [^\\s]+@[^\\s]+ ${stage}\\r?$`, "mu")); return { stage, start }; });
  const rows = sections.map(({ stage, start }, index) => {
    if (start < 0) return { stage, status: 'Not run', tests: null };
    const next = sections.slice(index + 1).find((s) => s.start >= 0)?.start ?? log.length;
    const section = log.slice(start, next);
    const status = sections.slice(index + 1).some((s) => s.start >= 0) || exitCode === 0 ? 'Passed' : 'Failed';
    let tests = null;
    if (stage === 'test:unit' || stage === 'test:api') {
      const count = (key) => Number(section.match(new RegExp(`^# ${key} (\\d+)`, 'mu'))?.[1] ?? 0);
      if (/^# tests /mu.test(section)) tests = { executed: count('tests'), passed: count('pass'), failed: count('fail') + count('cancelled'), skipped: count('skipped') };
    }
    if (stage === 'test:e2e') {
      const count = (key) => Number(section.match(new RegExp(`^\\s*(\\d+) ${key}\\b`, 'mu'))?.[1] ?? 0);
      if (/\d+ (?:passed|failed|skipped|flaky)/u.test(section)) { const passed = count('passed'), failed = count('failed') + count('flaky') + count('interrupted'), skipped = count('skipped'); tests = { executed: passed + failed + skipped, passed, failed, skipped }; }
    }
    return { stage, status, tests };
  });
  return { exitCode, rows };
}
export function summaryMarkdown(result) {
  const lines = ['# Validation results', '', `Overall: **${result.exitCode === 0 ? 'Passed' : 'Failed'}**`, '', '| Check | Status | Executed | Passed | Failed/cancelled/flaky | Skipped |', '| --- | --- | ---: | ---: | ---: | ---: |'];
  for (const row of result.rows) lines.push(`| ${row.stage} | ${row.status} | ${row.tests?.executed ?? '—'} | ${row.tests?.passed ?? '—'} | ${row.tests?.failed ?? '—'} | ${row.tests?.skipped ?? '—'} |`);
  lines.push('', 'Playwright executes the complete functional + E2E suite once. Unreached checks are not passes. Retries cannot hide flaky failures.', '');
  return lines.join('\n');
}
