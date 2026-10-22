/**
 * Plugin test without a dsh host: an in-process mock MemorySkills Portal
 * (MCP streamable HTTP + REST write) and a fake Cordis context.
 *
 *   node test/plugin.test.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import * as plugin from '../index.js';

const KEY = 'sk-mem-test';
const log = { writes: [], calls: [], inits: 0 };
const mcpSessions = new Set();

const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    if (req.headers.authorization !== `Bearer ${KEY}`) {
        res.writeHead(401, { 'WWW-Authenticate': 'Bearer realm="MemorySkills"' }).end('{"code":"SESSION_INVALID"}');
        return;
    }
    const body = raw ? JSON.parse(raw) : {};
    if (req.url === '/api/v1/memory/write') {
        log.writes.push(body.message);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ code: 'OK', msg: 'OK', data: { task_id: 't' } }));
        return;
    }
    if (req.url !== '/v1/mcp/memory/') { res.writeHead(404).end(); return; }
    const sse = (msg, headers = {}) => res.writeHead(200, { 'Content-Type': 'text/event-stream', ...headers })
        .end(`event: message\ndata: ${JSON.stringify(msg)}\n\n`);
    if (body.method === 'initialize') {
        log.inits += 1;
        const sid = `sid-${log.inits}`;
        mcpSessions.add(sid);
        sse({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'mock' } } }, { 'mcp-session-id': sid });
        return;
    }
    if (!mcpSessions.has(req.headers['mcp-session-id'])) { res.writeHead(404).end('session not found'); return; }
    if (body.method === 'notifications/initialized') { res.writeHead(202).end(); return; }
    if (body.method === 'tools/call') {
        const { message, search_switch: mode } = body.params.arguments;
        log.calls.push({ message, mode });
        if (mode === 'deep') { res.writeHead(429).end('{"code":"SLOW_READ_BUSY"}'); return; }
        const answer = mode === 'meta' ? '<user-info>\n喜欢蓝莓酸奶\n</user-info>\n' : `记忆(${mode}): ${message}`;
        sse({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify({ answer }) }], structuredContent: { answer }, isError: false } });
        return;
    }
    res.writeHead(400).end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const portal = `http://127.0.0.1:${server.address().port}`;

/** Fake host. `layer` overrides config; returns drivers for hooks/events. */
function fakeHost(layer = {}, { key = KEY } = {}) {
    const handlers = new Map();
    const effects = [];
    const warnings = [];
    let values = plugin.snapshotConfig(plugin.Config({ portalURL: portal, apiKeyEnv: 'MS_TEST_KEY', ...layer }));
    const config = Object.fromEntries(Object.keys(values).map((k) => [k, k === 'enabled' ? values[k] : { get: () => values[k] }]));
    const tools = new Map();
    const ctx = {
        logger: { info: () => {}, warn: (m) => warnings.push(m) },
        on: (event, fn) => handlers.set(event, fn),
        effect: (fn) => effects.push(fn()),
        get: (n) => (n === 'credentials' ? { resolve: async (ref) => (ref === 'MS_TEST_KEY' && key ? { value: key } : undefined) } : undefined),
        inject: (deps, cb) => cb({
            tools: { register: (def) => { tools.set(def.name, def); return () => tools.delete(def.name); } },
            effect: (fn) => effects.push(fn()),
        }),
    };
    plugin.apply(ctx, config);
    const session = { id: 's-1', header: {} };
    let t = Date.parse('2026-10-22T04:00:00Z');
    const emit = (type, data) => handlers.get('session/event')(session, { type, data, time: (t += 1000) });
    return {
        warnings,
        tools,
        turn(userText, answer) {
            emit('turn/start');
            emit('user/message', { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: userText }] });
            emit('assistant/message', { message: { content: [{ type: 'text', text: answer }] } });
            emit('turn/end', { reason: { kind: 'completed' } });
        },
        async preStep(text, history = []) {
            const msg = { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] };
            const s = { ...session, seq: history.length, eventAt: (i) => history[i] };
            return handlers.get('agent/pre-step')(
                { agent: { session: s }, step: 1, signal: new AbortController().signal },
                async () => ({ kind: 'continue', messages: [msg] }),
            );
        },
        set(next) { values = { ...values, ...next }; handlers.get('loader/volatile-update')(); },
        dispose() { effects.forEach((d) => d?.()); },
    };
}

const reset = () => { log.writes.length = 0; log.calls.length = 0; };
const settle = () => sleep(150);
const cases = [];
const test = (title, fn) => cases.push([title, fn]);

test('profile (meta) is injected on the first turn only; recall off by default', async () => {
    const host = fakeHost();
    const first = await host.preStep('我喜欢吃什么');
    assert.equal(first.messages.length, 2);
    const injected = first.messages[1];
    assert.equal(injected.source.kind, 'memoryskills-memory');
    assert.match(injected.content[0].text, /^\[MemorySkills profile/);
    assert.match(injected.content[0].text, /喜欢蓝莓酸奶/);
    assert.doesNotMatch(injected.content[0].text, /user-info/);
    assert.deepEqual(log.calls.map((c) => c.mode), ['meta']);
    const again = await host.preStep('再问一次', [{ type: 'user/message', data: injected }]);
    assert.equal(again.messages.length, 1, 'profile already in history: not reloaded');
});

test('per-turn recall when enabled, reusing one MCP session', async () => {
    const inits = log.inits;
    const host = fakeHost({ profile: false, recall: true, searchSwitch: 'quick' });
    const out = await host.preStep('我住在哪个城市');
    assert.match(out.messages[1].content[0].text, /记忆\(quick\): 我住在哪个城市/);
    await host.preStep('我养了什么宠物');
    assert.equal(log.inits - inits, 1);
});

test('a forgotten MCP session is re-initialized once', async () => {
    const host = fakeHost({ profile: false, recall: true });
    await host.preStep('第一次');
    const inits = log.inits;
    mcpSessions.clear();
    const out = await host.preStep('第二次');
    assert.match(out.messages[1].content[0].text, /第二次/);
    assert.equal(log.inits - inits, 1);
});

test('memory_search: chosen mode, and deep shed by 429 falls back to quick', async () => {
    const host = fakeHost();
    const tool = host.tools.get('memory_search');
    assert.deepEqual(tool.parameters.properties.search_switch.enum, ['express', 'quick', 'normal', 'deep']);
    assert.match(tool.description, /NOT recalled automatically/);
    const exec = { signal: new AbortController().signal };
    assert.equal((await tool.execute({ query: '旅行', search_switch: 'normal' }, exec)).answer, '记忆(normal): 旅行');
    const deep = await tool.execute({ query: '旅行', search_switch: 'deep' }, exec);
    assert.match(deep.answer, /^\[mode "deep" unavailable; results below are from "quick"\]\n记忆\(quick\)/);
    host.set({ toolSearchSwitches: ['express'] });
    assert.deepEqual(host.tools.get('memory_search').parameters.properties.search_switch.enum, ['express']);
});

test('batch mode writes every 3 turns as one labelled transcript', async () => {
    reset();
    const host = fakeHost();
    host.turn('我叫小陈', '你好小陈');
    host.turn('我对花生过敏', '记住了');
    await settle();
    assert.equal(log.writes.length, 0);
    host.turn('我喜欢燕麦拿铁', '好的');
    await settle();
    assert.equal(log.writes.length, 1);
    const w = log.writes[0];
    assert.match(w, /^\[对话时间 2026-10-22T04:00:01\.000Z\]\n用户：我叫小陈\n助手：你好小陈\n\n\[对话时间/);
    assert.match(w, /用户：我对花生过敏/);
    assert.match(w, /用户：我喜欢燕麦拿铁\n助手：好的$/);
});

test('turn mode writes immediately; unload flushes pending batch turns', async () => {
    reset();
    const host = fakeHost({ writeMode: 'turn' });
    host.turn('a1', 'b1');
    await settle();
    assert.equal(log.writes.length, 1);
    host.set({ writeMode: 'batch' });
    host.turn('a2', 'b2');
    await settle();
    assert.equal(log.writes.length, 1);
    host.dispose();
    await settle();
    assert.equal(log.writes.length, 2);
    assert.match(log.writes[1], /用户：a2/);
});

test('transcripts are split at 8000 chars and long answers clipped', () => {
    const cfg = { language: 'en', maxAssistantChars: 10 };
    const turns = Array.from({ length: 3 }, (_, i) => ({ at: `t${i}`, user: ['x'.repeat(3000)], assistant: 'y'.repeat(50) }));
    const out = plugin.renderTranscripts(turns, cfg);
    assert.equal(out.length, 2);
    assert.ok(out.every((m) => m.length <= 8000));
    assert.match(out[0], /Assistant: y{10}…/);
    assert.match(out[0], /^\[Conversation at t0\]\nUser: /);
});

test('missing key: warns, recall fails soft, turn still proceeds', async () => {
    const host = fakeHost({ recall: true }, { key: '' });
    const out = await host.preStep('我是谁');
    assert.equal(out.messages.length, 1);
    await settle();
    assert.ok(host.warnings.some((w) => /no API key under MS_TEST_KEY/.test(w)));
    assert.ok(host.warnings.some((w) => /profile load failed/.test(w)));
});

test('SSE parser picks the reply with the matching id', () => {
    const body = 'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\nevent: message\ndata: {"jsonrpc":"2.0","id":7,"result":{}}\n\n';
    assert.deepEqual(plugin.parseRpcBody('text/event-stream', body, 7), { jsonrpc: '2.0', id: 7, result: {} });
});

let failed = 0;
for (const [title, fn] of cases) {
    try {
        await fn();
        console.log(`ok   ${title}`);
    } catch (error) {
        failed += 1;
        console.log(`FAIL ${title}\n${error.stack}`);
    }
}
server.close();
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
