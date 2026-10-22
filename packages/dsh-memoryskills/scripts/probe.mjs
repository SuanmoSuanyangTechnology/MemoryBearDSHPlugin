#!/usr/bin/env node
/**
 * Read-only probe of a MemorySkills Portal: MCP tools/list, read_memory, end_user/info.
 *
 * Reads MEMORYSKILLS_BASE_URL and MEMORYSKILLS_API_KEY from the environment
 * (or ~/.config/redbear/secrets.env). Never prints the key. Writes nothing.
 *
 *   node scripts/probe.mjs [question] [search_switch]
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

function loadSecrets() {
    try {
        const out = {};
        for (const raw of readFileSync(`${homedir()}/.config/redbear/secrets.env`, 'utf8').split('\n')) {
            const line = raw.trim();
            if (!line || line.startsWith('#') || !line.includes('=')) continue;
            const i = line.indexOf('=');
            out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
        }
        return out;
    } catch { return {}; }
}

const secrets = loadSecrets();
const base = (process.env.MEMORYSKILLS_BASE_URL || secrets.MEMORYSKILLS_BASE_URL || 'https://memoryskills.redbearai.com').replace(/\/+$/, '');
const key = process.env.MEMORYSKILLS_API_KEY || secrets.MEMORYSKILLS_API_KEY;
if (!key) { console.error('no MEMORYSKILLS_API_KEY'); process.exit(1); }
const question = process.argv[2] || 'ping';
const mode = process.argv[3] || 'express';
console.log(`portal=${base} key=${key.slice(0, 7)}...(${key.length} chars)`);

let sessionId;
let rpcId = 0;
async function rpc(method, params, notify = false) {
    const headers = {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
    };
    if (sessionId) headers['mcp-session-id'] = sessionId;
    const body = notify ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++rpcId, method, params };
    const t0 = Date.now();
    const res = await fetch(`${base}/v1/mcp/memory/`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) });
    sessionId = res.headers.get('mcp-session-id') ?? sessionId;
    const text = await res.text();
    const ms = Date.now() - t0;
    if (notify) return { status: res.status, ms };
    const payload = text.trim().startsWith('{')
        ? JSON.parse(text)
        : JSON.parse(text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5)).pop() ?? 'null');
    return { status: res.status, ms, payload };
}

const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'dsh-memoryskills-probe', version: '0' } });
console.log(`initialize: HTTP ${init.status} ${init.ms}ms server=${JSON.stringify(init.payload?.result?.serverInfo)}`);
if (init.status !== 200) { console.log(JSON.stringify(init.payload).slice(0, 500)); process.exit(1); }
await rpc('notifications/initialized', {}, true);

const tools = await rpc('tools/list', {});
for (const t of tools.payload?.result?.tools ?? []) {
    const ss = t.inputSchema?.properties?.search_switch;
    console.log(`tool: ${t.name}${ss?.enum ? ` search_switch=${JSON.stringify(ss.enum)}` : ''}`);
}

const read = await rpc('tools/call', { name: 'read_memory', arguments: { message: question, search_switch: mode } });
const content = read.payload?.result?.content?.map((c) => c.text).join('\n') ?? JSON.stringify(read.payload?.error ?? read.payload);
console.log(`read_memory(${mode}, ${JSON.stringify(question)}): HTTP ${read.status} ${read.ms}ms isError=${read.payload?.result?.isError ?? false}`);
console.log(content.slice(0, 1500));

// PROBE_WRITE="<text>" also does one POST /api/v1/memory/write (uses one write quota).
if (process.env.PROBE_WRITE) {
    const t0 = Date.now();
    const w = await fetch(`${base}/api/v1/memory/write`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: process.env.PROBE_WRITE }),
        signal: AbortSignal.timeout(30_000),
    });
    console.log(`write: HTTP ${w.status} ${Date.now() - t0}ms ${(await w.text()).slice(0, 600)}`);
}

const info = await fetch(`${base}/api/v1/end_user/info`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30_000) });
const infoText = await info.text();
console.log(`end_user/info: HTTP ${info.status} ${infoText.slice(0, 600)}`);
