/**
 * Plugin test without a dsh host: an in-process mock MemorySkills Portal
 * (MCP streamable HTTP + REST write) and a fake Cordis context.
 *
 *   pnpm test
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { Config, snapshotConfig, type ConfigSnapshot, type PluginConfig } from '../src/config.js';
import type { Message, PluginContext, Session, SessionEvent, ToolRegistration } from '@redbear/dsh-memory-core';
import { apply } from '../src/index.js';
import { API_PATHS } from '../src/services/api.js';
import { parseRpcBody, type JsonRpcReply } from '../src/services/portal-client.js';
import { renderTranscripts } from '../src/services/transcript.js';

const KEY = 'sk-mem-test';
const log = {
    writes: [] as string[],
    calls: [] as Array<{ message: string; mode?: string }>,
    inits: 0,
};
const mcpSessions = new Set<string>();

const server: Server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    if (req.headers.authorization !== `Bearer ${KEY}`) {
        res.writeHead(401, { 'WWW-Authenticate': 'Bearer realm="MemorySkills"' }).end('{"code":"SESSION_INVALID"}');
        return;
    }
    const body = raw ? JSON.parse(raw) as Record<string, any> : {};
    if (req.url === API_PATHS.write) {
        log.writes.push(body.message);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ code: 'OK', msg: 'OK', data: { task_id: 't' } }));
        return;
    }
    if (req.url !== API_PATHS.mcp) { res.writeHead(404).end(); return; }
    const sse = (message: unknown, headers: Record<string, string> = {}) => res
        .writeHead(200, { 'Content-Type': 'text/event-stream', ...headers })
        .end(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
    if (body.method === 'initialize') {
        log.inits += 1;
        const sid = `sid-${log.inits}`;
        mcpSessions.add(sid);
        sse({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'mock' } } }, { 'mcp-session-id': sid });
        return;
    }
    if (!mcpSessions.has(req.headers['mcp-session-id'] as string)) { res.writeHead(404).end('session not found'); return; }
    if (body.method === 'notifications/initialized') { res.writeHead(202).end(); return; }
    if (body.method === 'tools/call') {
        const { message, search_switch: mode } = body.params.arguments as { message: string; search_switch?: string };
        log.calls.push({ message, mode });
        if (mode === 'deep') { res.writeHead(429).end('{"code":"SLOW_READ_BUSY"}'); return; }
        const answer = mode === 'meta' ? '<user-info>\n喜欢蓝莓酸奶\n</user-info>\n' : `记忆(${mode}): ${message}`;
        sse({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify({ answer }) }], structuredContent: { answer }, isError: false } });
        return;
    }
    res.writeHead(400).end();
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
after(() => new Promise<void>((resolve) => server.close(() => resolve())));
const address = server.address();
assert.ok(address !== null && typeof address === 'object');
const portal = `http://127.0.0.1:${address.port}`;

interface FakeHost {
    warnings: string[];
    tools: Map<string, ToolRegistration>;
    turn(userText: string, answer: string): void;
    preStep(text: string, history?: SessionEvent[]): Promise<{ messages: Message[] }>;
    set(next: Partial<ConfigSnapshot>): void;
    dispose(): void;
}

/** Fake host. `layer` overrides config; returns drivers for hooks/events. */
function fakeHost(layer: Record<string, unknown> = {}, { key = KEY } = {}): FakeHost {
    const handlers = new Map<string, (...args: any[]) => any>();
    const effects: Array<() => void> = [];
    const warnings: string[] = [];
    let values = {
        ...snapshotConfig(Config({ portalURL: portal, apiKeyEnv: 'MS_TEST_KEY', ...layer })),
    } as ConfigSnapshot;
    const config = Object.fromEntries(Object.keys(values).map((field) => [
        field,
        field === 'enabled' ? values[field] : { get: () => values[field] },
    ])) as unknown as PluginConfig;
    const tools = new Map<string, ToolRegistration>();
    const ctx = {
        logger: { info: () => {}, warn: (message: string) => warnings.push(message), error: () => {} },
        on: (event: string, handler: (...args: any[]) => any) => { handlers.set(event, handler); return () => handlers.delete(event); },
        effect: (effect: () => () => void) => { effects.push(effect()); },
        get: (name: string) => (name === 'credentials' ? { resolve: async (ref: string) => (ref === 'MS_TEST_KEY' && key ? { value: key } : undefined) } : undefined),
        inject: (_deps: string[], callback: (context: unknown) => void) => callback({
            tools: { register: (definition: ToolRegistration) => { tools.set(definition.name, definition); return () => tools.delete(definition.name); } },
            effect: (effect: () => () => void) => { effects.push(effect()); },
        }),
    } as unknown as PluginContext;
    apply(ctx, config);
    const session: Session = { id: 's-1', header: {}, eventAt: () => undefined };
    let time = Date.parse('2026-10-22T04:00:00Z');
    const emit = (type: string, data?: unknown) => {
        handlers.get('session/event')?.(session, { type, data, time: (time += 1000) });
    };
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
            const message = { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] };
            const withLog = { ...session, seq: history.length, eventAt: (index: number) => history[index] };
            return handlers.get('agent/pre-step')!(
                { agent: { session: withLog }, step: 1, signal: new AbortController().signal },
                async () => ({ kind: 'continue', messages: [message] }),
            );
        },
        set(next) {
            values = { ...values, ...next };
            handlers.get('loader/volatile-update')?.();
        },
        dispose: () => effects.forEach((dispose) => dispose?.()),
    };
}

const reset = () => { log.writes.length = 0; log.calls.length = 0; };
const settle = () => sleep(150);

test('profile (meta) is injected on the first turn only; recall off by default', async () => {
    const host = fakeHost();
    const first = await host.preStep('我喜欢吃什么');
    assert.equal(first.messages.length, 2);
    const injected = first.messages[1]!;
    assert.equal(injected.source?.kind, 'memoryskills-memory');
    assert.match((injected.content?.[0] as { text: string }).text, /^\[MemorySkills profile/);
    assert.match((injected.content?.[0] as { text: string }).text, /喜欢蓝莓酸奶/);
    assert.doesNotMatch((injected.content?.[0] as { text: string }).text, /user-info/);
    assert.deepEqual(log.calls.map((call) => call.mode), ['meta']);
    const again = await host.preStep('再问一次', [{ type: 'user/message', data: injected }]);
    assert.equal(again.messages.length, 1, 'profile already in history: not reloaded');
});

test('per-turn recall when enabled, reusing one MCP session', async () => {
    const inits = log.inits;
    const host = fakeHost({ profile: false, recall: true, searchSwitch: 'quick' });
    const out = await host.preStep('我住在哪个城市');
    assert.match((out.messages[1]!.content?.[0] as { text: string }).text, /记忆\(quick\): 我住在哪个城市/);
    await host.preStep('我养了什么宠物');
    assert.equal(log.inits - inits, 1);
});

test('a forgotten MCP session is re-initialized once', async () => {
    const host = fakeHost({ profile: false, recall: true });
    await host.preStep('第一次');
    const inits = log.inits;
    mcpSessions.clear();
    const out = await host.preStep('第二次');
    assert.match((out.messages[1]!.content?.[0] as { text: string }).text, /第二次/);
    assert.equal(log.inits - inits, 1);
});

test('memory_search: chosen mode, and deep shed by 429 falls back to quick', async () => {
    const host = fakeHost();
    const tool = host.tools.get('memory_search');
    assert.ok(tool);
    const properties = (tool.parameters as any).properties;
    assert.deepEqual(properties.search_switch.enum, ['express', 'quick', 'normal', 'deep']);
    assert.match(tool.description, /NOT recalled automatically/);
    const exec = { signal: new AbortController().signal };
    assert.equal(((await tool.execute({ query: '旅行', search_switch: 'normal' }, exec)) as { answer: string }).answer, '记忆(normal): 旅行');
    const deep = (await tool.execute({ query: '旅行', search_switch: 'deep' }, exec)) as { answer: string };
    assert.match(deep.answer, /^\[mode "deep" unavailable; results below are from "quick"\]\n记忆\(quick\)/);
    host.set({ toolSearchSwitches: ['express'] });
    assert.deepEqual((host.tools.get('memory_search')!.parameters as any).properties.search_switch.enum, ['express']);
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
    const write = log.writes[0]!;
    assert.match(write, /^\[对话时间 2026-10-22T04:00:01\.000Z\]\n用户：我叫小陈\n助手：你好小陈\n\n\[对话时间/);
    assert.match(write, /用户：我对花生过敏/);
    assert.match(write, /用户：我喜欢燕麦拿铁\n助手：好的$/);
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
    assert.match(log.writes[1]!, /用户：a2/);
});

test('transcripts are split at 8000 chars and long answers clipped', () => {
    const cfg = { language: 'en', maxAssistantChars: 10 };
    const turns = Array.from({ length: 3 }, (_, index) => ({ at: `t${index}`, user: ['x'.repeat(3000)], assistant: 'y'.repeat(50) }));
    const out = renderTranscripts(turns, cfg);
    assert.equal(out.length, 2);
    assert.ok(out.every((message) => message.length <= 8000));
    assert.match(out[0]!, /Assistant: y{10}…/);
    assert.match(out[0]!, /^\[Conversation at t0\]\nUser: /);
});

test('missing key: warns, recall fails soft, turn still proceeds', async () => {
    const host = fakeHost({ recall: true }, { key: '' });
    const out = await host.preStep('我是谁');
    assert.equal(out.messages.length, 1);
    await settle();
    assert.ok(host.warnings.some((warning) => /no API key under MS_TEST_KEY/.test(warning)));
    assert.ok(host.warnings.some((warning) => /profile load failed/.test(warning)));
});

test('SSE parser picks the reply with the matching id', () => {
    const body = 'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\nevent: message\ndata: {"jsonrpc":"2.0","id":7,"result":{}}\n\n';
    const expected: JsonRpcReply = { jsonrpc: '2.0', id: 7, result: {} } as JsonRpcReply;
    assert.deepEqual(parseRpcBody('text/event-stream', body, 7), expected);
});
