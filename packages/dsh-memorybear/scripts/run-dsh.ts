#!/usr/bin/env node
/**
 * Run one dsh turn on the `memorybear` profile with credentials from env files.
 *
 * Keys are read from ~/.config/redbear/secrets.env (falling back to the
 * file named by DSH_MEMORYBEAR_ENV_FILE) and passed only through the child
 * environment -- never on the command line or in the profile config.
 *
 *   pnpm dsh "<task text>"            # real MemoryBear service
 *   MEMORY_SERVICE_BASE_URL=http://127.0.0.1:18765 MEMORY_SERVICE_API_KEY=mock pnpm dsh "<task>"
 *   MB_ENV=test pnpm dsh "<task>"     # test env: reads TEST_MEMORY_* from secrets.env
 */
import { spawnSync } from 'node:child_process';
import { readEnvFile, SECRETS_PATH } from './lib/env.js';

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('usage: run-dsh.ts <task text>');
    process.exit(2);
}

const fallbackPath = process.env.DSH_MEMORYBEAR_ENV_FILE;
const sources = [
    process.env as Record<string, string | undefined>,
    readEnvFile(SECRETS_PATH),
    readEnvFile(fallbackPath ? fallbackPath.replace(/^~(?=\/)/, process.env.HOME ?? '~') : '/nonexistent'),
];

function lookup(name: string): string | undefined {
    for (const source of sources) {
        const value = source[name];
        if (value) return value;
    }
    return undefined;
}

// MB_ENV=test reads TEST_MEMORY_* and passes them to dsh under the plain names.
const mbEnv = process.env.MB_ENV ?? 'dev';
if (mbEnv !== 'dev' && mbEnv !== 'test') {
    console.error(`MB_ENV must be dev or test, got ${JSON.stringify(mbEnv)}`);
    process.exit(2);
}
const prefix = mbEnv === 'test' ? 'TEST_' : '';
const memoryNames = ['MEMORY_SERVICE_BASE_URL', 'MEMORY_SERVICE_API_KEY', 'MEMORY_ENDUSER_ID'] as const;

const env: NodeJS.ProcessEnv = { ...process.env };
const missing: string[] = [];
for (const name of ['SPEEDBEAR_API_KEY', ...memoryNames]) {
    const sourceName = memoryNames.includes(name as typeof memoryNames[number]) ? `${prefix}${name}` : name;
    // An explicit plain-name override in the shell (e.g. the mock URL) still wins.
    const value = process.env[name] || lookup(sourceName);
    if (value) env[name] = value;
    else missing.push(sourceName);
}
if (missing.length > 0) {
    console.error(`missing credentials (${mbEnv}): ${missing.join(', ')}`);
    process.exit(1);
}
// Optional model routes: loading a key does not select a route or change the default.
for (const name of ['DASHSCOPE_API_KEY', 'NEWAPI_API_KEY']) {
    const value = lookup(name);
    if (value) env[name] = value;
}
console.error(`[run-dsh] MemoryBear env: ${mbEnv}`);
const profile = process.env.DSH_PROFILE ?? 'memorybear';
const result = spawnSync('dsh', ['--profile', profile, ...args], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
