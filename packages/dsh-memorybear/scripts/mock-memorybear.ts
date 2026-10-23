#!/usr/bin/env node
/**
 * Local stand-in for the MemoryBear V1 API, for end-to-end plugin checks.
 * Binds 127.0.0.1 only. Logs every request (minus the bearer token) as JSONL.
 *
 *   pnpm mock [port] [logfile]
 */
import { writeFileSync } from 'node:fs';
import { startMockMemoryBear } from '../test/helpers/mock-memorybear.js';

const port = Number(process.argv[2] ?? 18765);
const logFile = process.argv[3] ?? 'mock-requests.jsonl';
writeFileSync(logFile, '');
const mock = await startMockMemoryBear({ port, logFile });
console.log(`mock MemoryBear on ${mock.url}`);

const stop = async () => {
    await mock.close();
    process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
