#!/usr/bin/env node
/**
 * Run dsh on the `memoryskills` profile with credentials from secrets.env.
 *
 * Keys are read from ~/.config/redbear/secrets.env and passed only through the
 * child environment -- never on the command line or in the profile config.
 *
 *   pnpm dsh "<task text>"                 # one headless turn
 *   pnpm dsh --session <id> "<task text>"  # resume a session
 *   DSH_PROFILE=memoryskills-web pnpm dsh --host 127.0.0.1 --port 8791 --no-open
 */
import { spawnSync } from 'node:child_process';
import { loadSecrets } from './lib/env.js';

const PASSTHROUGH = [
    'MEMORYSKILLS_BASE_URL',
    'MEMORYSKILLS_API_KEY',
    'DASHSCOPE_API_KEY',
    'SPEEDBEAR_API_KEY',
    'NEWAPI_API_KEY',
] as const;

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('usage: run-dsh.ts <dsh args...>');
    process.exit(2);
}

const secrets = loadSecrets();
const env: NodeJS.ProcessEnv = { ...process.env };
for (const name of PASSTHROUGH) {
    const value = process.env[name] || secrets[name];
    if (value) env[name] = value;
}
if (!env.MEMORYSKILLS_API_KEY) {
    console.error('missing MEMORYSKILLS_API_KEY');
    process.exit(1);
}
const portal = env.MEMORYSKILLS_BASE_URL ?? 'https://memoryskills.redbearai.com (default)';
console.error(`[run-dsh] MemorySkills portal: ${portal}`);
const profile = env.DSH_PROFILE ?? 'memoryskills';
const result = spawnSync('dsh', ['--profile', profile, ...args], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
