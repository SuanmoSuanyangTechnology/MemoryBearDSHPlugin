/**
 * Write-mode test for index.js without a dsh host: a fake Cordis context
 * replays session events, Config fields are `{ get() }` references like the
 * dsh 0.2 Loader's volatile fields, and a fake credential store supplies the key.
 * Writes go to test/mock-memorybear.mjs (started and stopped by this test),
 * whose request log is checked.
 *
 *   MOCK_LOG=<scratch>/mock.jsonl node test/write-modes.test.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import * as plugin from '../index.js';

const port = process.env.MOCK_PORT ?? '18766';
const log = process.env.MOCK_LOG;
assert.ok(log, 'MOCK_LOG is required');
writeFileSync(log, '');
const mock = spawn(process.execPath, [new URL('./mock-memorybear.mjs', import.meta.url).pathname, port, log], { stdio: 'ignore' });
process.on('exit', () => mock.kill());
await sleep(500);

/** Build a fake ctx; returns it plus handles to drive events and settings. */
function fakeHost(user = {}) {
    const handlers = new Map();
    const effects = [];
    const entry = { baseURL: `http://127.0.0.1:${port}/v1`, endUserId: 'u-1', apiKeyEnv: 'MB_TEST_KEY', ...user.base };
    let values;
    // Stand-in for the dsh 0.2 Loader: the profile entry is validated by the
    // schema, then each live field is a stable `{ get() }` reference whose
    // value a Plugins-page save replaces before `loader/volatile-update`.
    // writeIdleMinutes bypasses the schema so the idle test can use a sub-second window.
    const compose = (layer) => {
        const { writeIdleMinutes, ...rest } = layer;
        values = {
            ...plugin.snapshotConfig(plugin.Config({ ...entry, ...rest })),
            ...(writeIdleMinutes === undefined ? {} : { writeIdleMinutes }),
        };
    };
    compose(user.layer ?? {});
    const config = Object.fromEntries(Object.keys(values).map((key) => [
        key, key === 'enabled' ? values[key] : { get: () => values[key] },
    ]));
    const ctx = {
        logger: { info: () => {}, warn: (m) => console.warn('  warn:', m) },
        on: (event, fn) => handlers.set(event, fn),
        effect: (fn) => effects.push(fn()),
        get: (n) => (n === 'credentials' ? { resolve: async (ref) => (ref === 'MB_TEST_KEY' ? { value: 'k-from-store' } : undefined) } : undefined),
        tools: user.tools,
    };
    plugin.apply(ctx, config);
    const session = { id: 's-1', header: {} };
    let t = Date.parse('2026-10-14T03:00:00Z');
    const emit = (type, data) => handlers.get('session/event')(session, { type, data, time: (t += 1000) });
    return {
        turn(userText, answer) {
            emit('turn/start');
            emit('user/message', { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: userText }] });
            emit('assistant/message', { message: { content: [{ type: 'text', text: answer }] } });
            emit('turn/end', { reason: { kind: 'completed' } });
        },
        setUser(layer) { compose(layer); handlers.get('loader/volatile-update')?.(); },
        disposeSession: () => handlers.get('session/disposed')(session),
        disposePlugin: () => effects.forEach((d) => d?.()),
    };
}

const writes = () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)
    .map((l) => JSON.parse(l)).filter((r) => r.path === '/v1/memory/write');
const reset = () => writeFileSync(log, '');
const settle = () => sleep(150);

async function run(name, fn) {
    reset();
    await fn();
    console.log(`ok - ${name}`);
}

await run('turn: one write per completed turn, key from credential store', async () => {
    const h = fakeHost();
    h.turn('a1', 'b1');
    h.turn('a2', 'b2');
    await settle();
    const w = writes();
    assert.equal(w.length, 2);
    assert.deepEqual(w[0].body.messages.map((m) => m.content), ['a1', 'b1']);
    // MB_TEST_KEY is not in the env, so a bearer token proves the credential store answered.
    assert.equal(process.env.MB_TEST_KEY, undefined);
    assert.equal(w[0].hasBearer, true);
});

await run('batch: writes every N turns in one call; tail flushed on session dispose', async () => {
    const h = fakeHost({ layer: { writeMode: 'batch', writeEveryTurns: 2 } });
    h.turn('a1', 'b1');
    await settle();
    assert.equal(writes().length, 0);
    h.turn('a2', 'b2');
    await settle();
    assert.equal(writes().length, 1);
    assert.deepEqual(writes()[0].body.messages.map((m) => m.content), ['a1', 'b1', 'a2', 'b2']);
    h.turn('a3', 'b3');
    h.disposeSession();
    await settle();
    assert.equal(writes().length, 2);
    assert.deepEqual(writes()[1].body.messages.map((m) => m.content), ['a3', 'b3']);
});

await run('idle: nothing until idle; a new turn restarts the window', async () => {
    const h = fakeHost({ layer: { writeMode: 'idle', writeIdleMinutes: 0.01 } }); // 600 ms
    h.turn('a1', 'b1');
    await sleep(400);
    h.turn('a2', 'b2'); // within the window: timer restarts
    await sleep(400);
    assert.equal(writes().length, 0);
    await sleep(500);
    assert.equal(writes().length, 1);
    assert.deepEqual(writes()[0].body.messages.map((m) => m.content), ['a1', 'b1', 'a2', 'b2']);
});

await run('switching to turn mode flushes buffered turns', async () => {
    const h = fakeHost({ layer: { writeMode: 'batch', writeEveryTurns: 5 } });
    h.turn('a1', 'b1');
    await settle();
    assert.equal(writes().length, 0);
    h.setUser({ writeMode: 'turn' });
    await settle();
    assert.equal(writes().length, 1);
});

await run('plugin dispose flushes pending turns; settings change of endUserId applies live', async () => {
    const h = fakeHost({ layer: { writeMode: 'idle', writeIdleMinutes: 60 } });
    h.turn('a1', 'b1');
    h.setUser({ writeMode: 'idle', writeIdleMinutes: 60, endUserId: 'u-2' });
    h.disposePlugin();
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(writes()[0].body.end_user_id, 'u-2');
});

await run('tool settings re-register memory_search live', async () => {
    const live = new Map();
    const tools = { register: (def) => { live.set(def.name, def); return () => live.delete(def.name); } };
    // defineTool compiles `parameters`; read the mode enum from the serialized definition.
    const modes = () => JSON.parse(JSON.stringify(live.get('memory_search')).match(/"enum":(\[[^\]]*\])/)[1]);
    const h = fakeHost({ tools, layer: { toolSearchSwitches: ['express', 'quick'] } });
    assert.deepEqual(modes(), ['express', 'quick']);
    h.setUser({ toolSearchSwitches: ['express', 'quick', 'deep'] });
    assert.deepEqual(modes(), ['express', 'quick', 'deep']);
    h.setUser({ tool: false });
    assert.equal(live.has('memory_search'), false);
    h.setUser({ tool: true });
    assert.equal(live.has('memory_search'), true);
});

console.log('all write-mode tests passed');
process.exit(0);
