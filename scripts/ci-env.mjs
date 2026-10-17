/** A reproducible mock-only environment for the complete validation subprocess.
 * Local ignored .env files cannot override explicitly empty credentials. */
/** @param {Record<string, string | undefined>} source @returns {Record<string, string>} */
export function mockCIEnvironment(source = process.env) {
  const env = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined));
  for (const key of Object.keys(env)) if (/^(?:OPENAI_|SERPAPI_|API_|AI_|WEB_|RECIPE_)/u.test(key)) delete env[key];
  delete env.NODE_ENV;
  return { ...env, CI: 'true', NEXT_TELEMETRY_DISABLED: '1', OPENAI_API_KEY: '', SERPAPI_API_KEY: '', API_REDIS_REST_URL: '', API_REDIS_REST_TOKEN: '', API_IDENTITY_SECRET: 'synthetic-ci-identity-secret-never-for-production', API_SECURITY_NAMESPACE: 'aichef-e2e', API_CLIENT_IDENTITY: 'shared', API_SECURITY_MODE: 'local-test', RECIPE_SEARCH_MODE: 'demo', WEB_SEARCH_PROVIDER: 'serpapi' };
}
