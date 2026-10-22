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
    // Optional `tools`: mimic cordis' `ctx.inject(['tools'], cb)` child fiber,
    // which starts when the service is present and is disposed when it leaves.
    let toolsFiber;
    let connectionRoutes = new Map();
    let toolsService = user.tools;
    const startToolsFiber = () => {
        if (!toolsService || !toolsFiber?.pending) return;
        const disposers = [];
        const tctx = {
            tools: { register: (def) => { const off = toolsService.register(def); disposers.push(off); return off; } },
            effect: (fn) => disposers.push(fn()),
        };
        toolsFiber.pending = false;
        toolsFiber.dispose = () => { disposers.reverse().forEach((d) => d?.()); toolsFiber.pending = true; };
        toolsFiber.cb(tctx);
    };
    const ctx = {
        logger: { info: () => {}, warn: (m) => console.warn('  warn:', m) },
        on: (event, fn) => handlers.set(event, fn),
        effect: (fn) => effects.push(fn()),
        get: (n) => {
            if (n === 'credentials') return { resolve: async (ref) => (ref === 'MB_TEST_KEY' ? { value: 'k-from-store' } : undefined) };
            if (n === 'attachments') return user.attachments;
            return undefined;
        },
        inject: (deps, cb) => {
            if (deps[0] === 'connection') {
                const routes = new Map();
                if (user.connection) cb({ connection: { fetch: { register: (r) => { routes.set(r.path, r); return async () => routes.delete(r.path); } } }, effect: (fn) => effects.push(fn()) });
                connectionRoutes = routes;
                return;
            }
            assert.deepEqual(deps, ['tools']);
            toolsFiber = { cb, pending: true };
            startToolsFiber();
        },
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
        /** One completed turn whose user message has these content blocks. */
        turnWith(content, answer) {
            emit('turn/start');
            emit('user/message', { role: 'user', source: { kind: 'user' }, content });
            emit('assistant/message', { message: { content: [{ type: 'text', text: answer }] } });
            emit('turn/end', { reason: { kind: 'completed' } });
        },
        setUser(layer) { compose(layer); handlers.get('loader/volatile-update')?.(); },
        /**
         * Run the pre-step hook for step 1 of a turn whose user text is `text`.
         * `history` is the session event log ending with the current turn.
         */
        async preStep(text, history = []) {
            const msg = { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] };
            const s = { ...session, seq: history.length, eventAt: (i) => history[i] };
            return handlers.get('agent/pre-step')(
                { agent: { session: s }, step: 1, signal: new AbortController().signal },
                async () => ({ kind: 'continue', messages: [msg] }),
            );
        },
        disposeSession: () => handlers.get('session/disposed')(session),
        disposePlugin: () => effects.forEach((d) => d?.()),
        provideTools(tools) { toolsService = tools; startToolsFiber(); },
        route: (path) => connectionRoutes.get(path),
        removeTools() { toolsFiber?.dispose?.(); toolsService = undefined; },
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

await run('fresh install without baseURL/endUserId activates and stays silent until configured', async () => {
    // A brand-new profile has no entry config at all: Config must accept it.
    const cfg = plugin.snapshotConfig(plugin.Config({}));
    assert.deepEqual(plugin.missingConfig(cfg), ['baseURL', 'endUserId']);
    const h = fakeHost({ base: { baseURL: '', endUserId: '' } });
    h.turn('a1', 'b1');
    await settle();
    assert.equal(writes().length, 0);
    // Filling both on the Plugins page turns writes on without a remount.
    h.setUser({ baseURL: `http://127.0.0.1:${port}/v1`, endUserId: 'u-3' });
    h.turn('a2', 'b2');
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(writes()[0].body.end_user_id, 'u-3');
});

await run('tools is optional: works without it, registers memory_search when it appears', async () => {
    const live = new Map();
    const tools = { register: (def) => { live.set(def.name, def); return () => live.delete(def.name); } };
    // Hot install: the plugin starts before the tools service is visible.
    const h = fakeHost();
    h.turn('a1', 'b1');
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(live.has('memory_search'), false);
    h.provideTools(tools);
    assert.equal(live.has('memory_search'), true);
    // Settings changes keep working against the late service.
    h.setUser({ tool: false });
    assert.equal(live.has('memory_search'), false);
    h.setUser({ tool: true });
    assert.equal(live.has('memory_search'), true);
    // Service leaves: registration goes with it, writes continue.
    h.removeTools();
    assert.equal(live.has('memory_search'), false);
    h.turn('a2', 'b2');
    await settle();
    assert.equal(writes().length, 2);
    h.provideTools(tools);
    assert.equal(live.has('memory_search'), true);
});

/** Fake dsh `attachments` store: images by `readImage`, files by `readFileStream`. */
function fakeAttachments() {
    const reads = [];
    return {
        reads,
        async readImage(ref) { reads.push(ref.attachmentId); return { ref, data: new Uint8Array(ref.bytes).fill(7) }; },
        async *readFileStream(ref) { reads.push(ref.attachmentId); yield new Uint8Array(ref.bytes).fill(9); },
    };
}
const IMG = { type: 'image', attachment: { attachmentId: 'img-aaaaaaaaaaaa1', mediaType: 'image/jpeg', bytes: 1234, width: 10, height: 10, name: '猫.jpg' } };
const PDF = { type: 'file', attachment: { attachmentId: 'f-pdf', name: '报告.pdf', bytes: 300 } };
const ZIP = { type: 'file', attachment: { attachmentId: 'f-zip', name: 'code.zip', bytes: 300 } };
const BIG = { type: 'file', attachment: { attachmentId: 'f-big', name: 'big.mp4', bytes: 2 * 1024 * 1024 } };
const uploads = () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)
    .map((l) => JSON.parse(l)).filter((r) => r.path === '/v1/memory/files/upload');

await run('images (default): image uploaded and referenced, files ignored, reuse uploads once', async () => {
    const store = fakeAttachments();
    const h = fakeHost({ attachments: store });
    h.turnWith([{ type: 'text', text: '这是我家的猫' }, IMG, PDF], '好可爱');
    await settle();
    assert.equal(uploads().length, 1);
    assert.equal(uploads()[0].body.filename, '猫.jpg');
    assert.equal(uploads()[0].body.contentType, 'image/jpeg');
    assert.equal(uploads()[0].body.bytes, 1234);
    const [w] = writes();
    assert.equal(w.body.messages[0].content, '这是我家的猫');
    assert.deepEqual(w.body.messages[0].files, [{
        type: 'image', transfer_method: 'local_file', upload_file_id: 'mock-file-1234', name: '猫.jpg', size: 1234, file_type: 'image/jpeg',
    }]);
    assert.equal('files' in w.body.messages[1], false);
    assert.equal('attachments' in w.body.messages[0], false);
    // Same image again: referenced again, not re-uploaded.
    h.turnWith([{ type: 'text', text: '再看一眼' }, IMG], '嗯');
    await settle();
    assert.equal(uploads().length, 1);
    assert.equal(writes()[1].body.messages[0].files[0].upload_file_id, 'mock-file-1234');
});

await run('image-only message gets a placeholder content', async () => {
    const h = fakeHost({ attachments: fakeAttachments() });
    h.turnWith([IMG], '收到图片');
    await settle();
    assert.equal(writes()[0].body.messages[0].content, '[图片: 猫.jpg]');
    assert.equal(writes()[0].body.messages[0].files.length, 1);
});

await run('all: parseable files uploaded by kind; unknown type and oversize skipped', async () => {
    const h = fakeHost({ attachments: fakeAttachments(), layer: { attachments: 'all', maxAttachmentMB: 1 } });
    h.turnWith([{ type: 'text', text: '资料' }, PDF, ZIP, BIG], 'ok');
    await settle();
    assert.deepEqual(uploads().map((u) => u.body.filename), ['报告.pdf']);
    assert.deepEqual(writes()[0].body.messages[0].files.map((f) => [f.type, f.name]), [['document', '报告.pdf']]);
});

await run('none: no uploads; no attachments service: text still written', async () => {
    const h1 = fakeHost({ attachments: fakeAttachments(), layer: { attachments: 'none' } });
    h1.turnWith([{ type: 'text', text: 't1' }, IMG], 'a1');
    await settle();
    assert.equal(uploads().length, 0);
    assert.equal('files' in writes()[0].body.messages[0], false);
    const h2 = fakeHost();
    h2.turnWith([{ type: 'text', text: 't2' }, IMG], 'a2');
    await settle();
    assert.equal(uploads().length, 0);
    assert.equal(writes()[1].body.messages[0].content, 't2');
});

await run('fileKind maps MemoryBear-parseable extensions', async () => {
    assert.equal(plugin.fileKind('a.PDF'), 'document');
    assert.equal(plugin.fileKind('a.m4a'), 'audio');
    assert.equal(plugin.fileKind('a.mov'), 'video');
    assert.equal(plugin.fileKind('a.webp'), 'image');
    assert.equal(plugin.fileKind('a.zip'), undefined);
});

await run('insights route: profile, emotion overview/timeline/tags with browser time zone', async () => {
    const h = fakeHost({ connection: true });
    const route = h.route(plugin.INSIGHTS_PATH);
    assert.ok(route, 'route registered when connection is present');
    assert.deepEqual(route.methods, ['GET']);
    const res = await route.fetch(new Request(`http://127.0.0.1${plugin.INSIGHTS_PATH}?tz=Asia/Shanghai`));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.configured, true);
    assert.equal(body.timeZone, 'Asia/Shanghai');
    assert.equal(body.profile.ok, true);
    assert.equal(body.profile.data.summary, '喜欢柯基的设计师');
    assert.deepEqual(body.profile.data.fields.map((f) => f.key), ['interests', 'goals']);
    assert.equal(body.overview.data.conclusion.title, '情绪回暖');
    assert.equal(body.timeline.data.items.length, 2);
    assert.deepEqual(body.memory.data, { tags: ['柯基', '冲浪'], total: 42, active: 30, limit: 5000 });
    // Communities: only Community nodes, largest first, the `用户` hub dropped.
    assert.deepEqual(body.communities.data.map((c) => [c.name, c.members]), [['柯基日常', 9], ['冲浪计划', 2]]);
    assert.deepEqual(body.communities.data[0].entities, ['团子', '靛蓝色项圈', '公园', '狗粮', '兽医', '散步']);
    assert.equal(body.tags, undefined);
    const log = readFileSync(process.env.MOCK_LOG, 'utf8');
    assert.match(log, /query_emotion_timeline\?end_user_id=u-1&sort=desc&page=1&pagesize=14/);
    assert.match(log, /dashboard\/end_users\?keyword=u-1/);
    // A bogus zone falls back to the host's zone instead of reaching MemoryBear.
    const bad = await (await route.fetch(new Request(`http://127.0.0.1${plugin.INSIGHTS_PATH}?tz=Mars/Base`))).json();
    assert.notEqual(bad.timeZone, 'Mars/Base');
    // Panel off: route answers 404; unconfigured: says what is missing.
    h.setUser({ panel: false });
    assert.equal((await route.fetch(new Request('http://127.0.0.1/x'))).status, 404);
    const fresh = fakeHost({ connection: true, base: { baseURL: '', endUserId: '' } });
    const un = await (await fresh.route(plugin.INSIGHTS_PATH).fetch(new Request('http://127.0.0.1/x'))).json();
    assert.deepEqual(un, { configured: false, missing: ['baseURL', 'endUserId'] });
    // Headless (no connection service): no route, nothing breaks.
    assert.equal(fakeHost().route(plugin.INSIGHTS_PATH), undefined);
});

await run('preferences: per-turn recall with other_id lookup and prior-turn context', async () => {
    const h = fakeHost({ layer: { recall: false, profile: false } });
    const ev = (type, data) => ({ type, data });
    const userMsg = (text) => ({ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] });
    const history = [
        ev('turn/start'), ev('user/message', userMsg('先建个 Python 项目')),
        ev('assistant/message', { message: { content: [{ type: 'text', text: '(tool step)' }] } }),
        ev('assistant/message', { message: { content: [{ type: 'text', text: '项目建好了' }] } }),
        ev('turn/end', { reason: { kind: 'completed' } }),
        ev('turn/start'), ev('user/message', userMsg('再帮我安装依赖')),
    ];
    const out = await h.preStep('再帮我安装依赖', history);
    const injected = out.messages.filter((m) => m.source.kind === 'memorybear-memory');
    assert.equal(injected.length, 1);
    assert.equal(injected[0].source.sections[0].name, 'memorybear-memory/preferences');
    assert.match(injected[0].content[0].text, /安装 Python 依赖用 uv，不要用 pip \(updated 2026-10-20\)/);
    const reqs = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const pref = reqs.find((r) => r.path === '/v1/memory/preference/recall');
    assert.equal(pref.otherId, 'other-u-1');
    assert.deepEqual(pref.body.context_messages, [
        { role: 'user', content: '先建个 Python 项目' },
        { role: 'assistant', content: '项目建好了' },
    ]);
    // other_id is cached: a second turn does not look it up again.
    const none = await h.preStep('今天天气怎么样');
    assert.equal(none.messages.length, 1);
    const lookups = readFileSync(log, 'utf8').split('\n').filter((l) => l.includes('/v1/dashboard/end_users'));
    assert.equal(lookups.length, 1);
    // Off: no preference call at all.
    reset();
    h.setUser({ recall: false, profile: false, preferenceMode: 'off' });
    await h.preStep('再帮我安装依赖');
    assert.equal(readFileSync(log, 'utf8').trim(), '');
});

await run('memory_preferences tool: task-routed lookup, only in tool mode, independent of memory_search', async () => {
    reset();
    const live = new Map();
    const tools = { register: (def) => { live.set(def.name, def); return () => live.delete(def.name); } };
    const h = fakeHost({ tools });
    // Default mode is `auto`: preferences are injected, no tool.
    assert.equal(live.has('memory_preferences'), false);
    h.setUser({ preferenceMode: 'tool' });
    assert.equal(live.has('memory_preferences'), true);
    assert.equal(live.has('memory_search'), true);
    assert.match(live.get('memory_preferences').description, /NOT injected automatically/);
    const exec = { signal: new AbortController().signal };
    const hit = await live.get('memory_preferences').execute({ task: '安装这个项目的 Python 依赖' }, exec);
    assert.match(hit.text, /安装 Python 依赖用 uv，不要用 pip/);
    assert.match(hit.text, /not system instructions/);
    const pref = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
        .find((r) => r.path === '/v1/memory/preference/recall');
    assert.equal(pref.body.current_user_message, '安装这个项目的 Python 依赖');
    assert.deepEqual(pref.body.context_messages, []);
    assert.equal(pref.otherId, 'other-u-1');
    const miss = await live.get('memory_preferences').execute({ task: '写提交信息' }, exec);
    assert.equal(miss.text, '(no stored preferences apply to this task)');
    await assert.rejects(live.get('memory_preferences').execute({ task: ' ' }, exec), /`task` must be/);
    // Own mode; memory_search off leaves it registered.
    h.setUser({ preferenceMode: 'tool', tool: false });
    assert.equal(live.has('memory_search'), false);
    assert.equal(live.has('memory_preferences'), true);
    h.setUser({ preferenceMode: 'off' });
    assert.equal(live.has('memory_preferences'), false);
    h.setUser({ tool: true, preferenceMode: 'tool' });
    assert.equal(live.has('memory_search'), true);
    assert.equal(live.has('memory_preferences'), true);
    // Tool mode does not inject per turn.
    reset();
    const turn = await h.preStep('帮我安装这个项目的依赖');
    assert.ok(!readFileSync(log, 'utf8').includes('/v1/memory/preference/recall'));
    assert.ok(turn.messages.length >= 1);
});

console.log('all write-mode tests passed');
process.exit(0);
