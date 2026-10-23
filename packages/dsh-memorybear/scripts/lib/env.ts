/**
 * Dotenv helpers shared by the developer scripts.
 *
 * @module dsh-memoryskills/scripts/lib/env
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Default credential file used by the MemoryBear team. */
export const SECRETS_PATH = join(homedir(), '.config/redbear/secrets.env');

/** Parse a dotenv file; a missing file yields an empty mapping. */
export function readEnvFile(path: string): Record<string, string> {
    const values: Record<string, string> = {};
    let text: string;
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return values;
    }
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) continue;
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim().replace(/^export\s+/, '');
        values[key] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    }
    return values;
}
