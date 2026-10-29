/**
 * Write-mode test for the Host half without a dsh host: a fake Cordis context
 * replays session events, Config fields are `{ get() }` references like the
 * dsh 0.2 Loader's volatile fields, and a fake credential store supplies the key.
 * Writes go to an in-process MemoryBear mock, whose request log is checked.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { Config, missingConfig, snapshotConfig, type ConfigSnapshot, type PluginConfig } from '../src/config.js';
import type {
    AttachmentsService,
    ConnectionRoute,
    PluginContext,
    Session,
    SessionEvent,
    ToolRegistration,
    ToolsService,
} from '@redbearai/dsh-memory-core';
import { INSIGHTS_PATH, UPDATE_PATH } from '../src/constants.js';
import { API_PATHS } from '../src/services/api.js';
import { apply } from '../src/index.js';
import { fileKind } from '../src/services/payloads.js';
import { startMockMemoryBear, type MockMemoryBear, type MockRequest } from './helpers/mock-memorybear.js';

let mock: MockMemoryBear;

before(async () => {
    mock = await startMockMemoryBear();
});
after(async () => {
    await mock.close();
});

interface FakeHostOptions {
    base?: Record<string, unknown>;
    layer?: Record<string, unknown>;
    tools?: ToolsService;
    attachments?: AttachmentsService;
    connection?: boolean;
}

interface FakeHost {
    warnings: string[];
    turn(userText: string, answer: string): void;
    turnWith(content: unknown[], answer: string): void;
    setUser(layer: Record<string, unknown>): void;
    preStep(text: string, history?: SessionEvent[]): Promise<{ messages: Array<Record<string, any>> }>;
    disposeSession(): void;
    disposePlugin(): void;
    provideTools(tools: ToolsService): void;
    route(path: string): ConnectionRoute | undefined;
    removeTools(): void;
}

/** Build a fake ctx; returns it plus handles to drive events and settings. */
function fakeHost(user: FakeHostOptions = {}): FakeHost {
    const handlers = new Map<string, (...args: any[]) => any>();
    const effects: Array<() => void> = [];
    const warnings: string[] = [];
    const entry = { updateCheck: false, baseURL: mock.url, endUserId: 'u-1', apiKeyEnv: 'MB_TEST_KEY', ...user.base };
    let values!: ConfigSnapshot;
    // Stand-in for the dsh 0.2 Loader: the profile entry is validated by the
    // schema, then each live field is a stable `{ get() }` reference whose
    // value a Plugins-page save replaces before `loader/volatile-update`.
    // writeIdleMinutes bypasses the schema so the idle test can use a sub-second window.
    const compose = (layer: Record<string, unknown>) => {
        const { writeIdleMinutes, ...rest } = layer;
        values = {
            ...snapshotConfig(Config({ ...entry, ...rest } as any)),
            ...(writeIdleMinutes === undefined ? {} : { writeIdleMinutes }),
        } as ConfigSnapshot;
    };
    compose(user.layer ?? {});
    const config = Object.fromEntries(Object.keys(values).map((field) => [
        field, field === 'enabled' ? values[field as keyof ConfigSnapshot] : { get: () => values[field as keyof ConfigSnapshot] },
    ])) as unknown as PluginConfig;
    // Optional `tools`: mimic cordis' `ctx.inject(['tools'], cb)` child fiber,
    // which starts when the service is present and is disposed when it leaves.
    let toolsFiber: { cb: (context: unknown) => void; pending: boolean; dispose?: () => void } | undefined;
    let connectionRoutes = new Map<string, ConnectionRoute>();
    let toolsService = user.tools;
    const startToolsFiber = () => {
        if (!toolsService || !toolsFiber?.pending) return;
        const disposers: Array<() => void> = [];
        const context = {
            tools: { register: (definition: ToolRegistration) => { const off = toolsService!.register(definition); disposers.push(off); return off; } },
            effect: (effect: () => () => void) => disposers.push(effect()),
        };
        toolsFiber.pending = false;
        toolsFiber.dispose = () => { disposers.reverse().forEach((dispose) => dispose?.()); toolsFiber!.pending = true; };
        toolsFiber.cb(context);
    };
    const ctx = {
        logger: { info: () => {}, warn: (message: string) => warnings.push(message), error: () => {} },
        on: (event: string, handler: (...args: any[]) => any) => { handlers.set(event, handler); return () => handlers.delete(event); },
        effect: (effect: () => () => void) => { effects.push(effect()); },
        get: (name: string) => {
            if (name === 'credentials') return { resolve: async (ref: string) => (ref === 'MB_TEST_KEY' ? { value: 'k-from-store' } : undefined) };
            if (name === 'attachments') return user.attachments;
            return undefined;
        },
        inject: (deps: string[], callback: (context: unknown) => void) => {
            if (deps[0] === 'connection') {
                if (user.connection) {
                    callback({
                        connection: {
                            fetch: {
                                register: (route: ConnectionRoute) => {
                                    connectionRoutes.set(route.path, route);
                                    return async () => { connectionRoutes.delete(route.path); };
                                },
                            },
                        },
                        effect: (effect: () => () => void) => { effects.push(effect()); },
                    });
                }
                return;
            }
            assert.deepEqual(deps, ['tools']);
            toolsFiber = { cb: callback, pending: true };
            startToolsFiber();
        },
    } as unknown as PluginContext;
    apply(ctx, config);
    const session: Session = { id: 's-1', header: {}, eventAt: () => undefined };
    let time = Date.parse('2026-10-14T03:00:00Z');
    const emit = (type: string, data?: unknown) => {
        handlers.get('session/event')!(session, { type, data, time: (time += 1000) });
    };
    return {
        warnings,
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
        setUser(layer) {
            compose(layer);
            handlers.get('loader/volatile-update')?.();
        },
        /**
         * Run the pre-step hook for step 1 of a turn whose user text is `text`.
         * `history` is the session event log ending with the current turn.
         */
        async preStep(text, history = []) {
            const message = { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] };
            const withLog = { ...session, seq: history.length, eventAt: (index: number) => history[index] };
            return handlers.get('agent/pre-step')!(
                { agent: { session: withLog }, step: 1, signal: new AbortController().signal },
                async () => ({ kind: 'continue', messages: [message] }),
            );
        },
        disposeSession: () => handlers.get('session/disposed')!(session),
        disposePlugin: () => effects.forEach((dispose) => dispose?.()),
        provideTools(tools) { toolsService = tools; startToolsFiber(); },
        route: (path) => connectionRoutes.get(path),
        removeTools() { toolsFiber?.dispose?.(); toolsService = undefined; },
    };
}

interface WrittenBody {
    messages: Array<{ role: string; content: string; files?: Array<Record<string, unknown>>; attachments?: unknown }>;
    end_user_id?: string;
}

const writes = (): Array<MockRequest & { body: WrittenBody }> => mock.requests
    .filter((request) => request.path === '/v1/memory/write') as Array<MockRequest & { body: WrittenBody }>;
const uploads = (): MockRequest[] => mock.requests.filter((request) => request.path === '/v1/memory/files/upload');
const reset = () => { mock.requests.length = 0; };
const settle = () => sleep(150);

test('turn: one write per completed turn, key from credential store', async () => {
    reset();
    const host = fakeHost();
    host.turn('a1', 'b1');
    host.turn('a2', 'b2');
    await settle();
    const written = writes();
    assert.equal(written.length, 2);
    assert.deepEqual(written[0]!.body.messages.map((message) => message.content), ['a1', 'b1']);
    // MB_TEST_KEY is not in the env, so a bearer token proves the credential store answered.
    assert.equal(process.env.MB_TEST_KEY, undefined);
    assert.equal(written[0]!.hasBearer, true);
});

test('batch: writes every N turns in one call; tail flushed on session dispose', async () => {
    reset();
    const host = fakeHost({ layer: { writeMode: 'batch', writeEveryTurns: 2 } });
    host.turn('a1', 'b1');
    await settle();
    assert.equal(writes().length, 0);
    host.turn('a2', 'b2');
    await settle();
    assert.equal(writes().length, 1);
    assert.deepEqual(writes()[0]!.body.messages.map((message) => message.content), ['a1', 'b1', 'a2', 'b2']);
    host.turn('a3', 'b3');
    host.disposeSession();
    await settle();
    assert.equal(writes().length, 2);
    assert.deepEqual(writes()[1]!.body.messages.map((message) => message.content), ['a3', 'b3']);
});

test('idle: nothing until idle; a new turn restarts the window', async () => {
    reset();
    const host = fakeHost({ layer: { writeMode: 'idle', writeIdleMinutes: 0.01 } }); // 600 ms
    host.turn('a1', 'b1');
    await sleep(400);
    host.turn('a2', 'b2'); // within the window: timer restarts
    await sleep(400);
    assert.equal(writes().length, 0);
    await sleep(500);
    assert.equal(writes().length, 1);
    assert.deepEqual(writes()[0]!.body.messages.map((message) => message.content), ['a1', 'b1', 'a2', 'b2']);
});

test('switching to turn mode flushes buffered turns', async () => {
    reset();
    const host = fakeHost({ layer: { writeMode: 'batch', writeEveryTurns: 5 } });
    host.turn('a1', 'b1');
    await settle();
    assert.equal(writes().length, 0);
    host.setUser({ writeMode: 'turn' });
    await settle();
    assert.equal(writes().length, 1);
});

test('plugin dispose flushes pending turns; settings change of endUserId applies live', async () => {
    reset();
    const host = fakeHost({ layer: { writeMode: 'idle', writeIdleMinutes: 60 } });
    host.turn('a1', 'b1');
    host.setUser({ writeMode: 'idle', writeIdleMinutes: 60, endUserId: 'u-2' });
    host.disposePlugin();
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(writes()[0]!.body.end_user_id, 'u-2');
});

test('tool settings re-register memory_search live', async () => {
    const live = new Map<string, ToolRegistration>();
    const tools: ToolsService = { register: (definition) => { live.set(definition.name, definition); return () => live.delete(definition.name); } };
    const modes = () => (live.get('memory_search')!.parameters as any).properties.search_switch.enum;
    const host = fakeHost({ tools, layer: { toolSearchSwitches: ['express', 'quick'] } });
    assert.deepEqual(modes(), ['express', 'quick']);
    host.setUser({ toolSearchSwitches: ['express', 'quick', 'deep'] });
    assert.deepEqual(modes(), ['express', 'quick', 'deep']);
    host.setUser({ tool: false });
    assert.equal(live.has('memory_search'), false);
    host.setUser({ tool: true });
    assert.equal(live.has('memory_search'), true);
});

test('fresh install without baseURL/endUserId activates and stays silent until configured', async () => {
    reset();
    // A brand-new profile has no entry config at all: Config must accept it.
    const cfg = snapshotConfig(Config({})) as ConfigSnapshot;
    assert.deepEqual(missingConfig(cfg), ['baseURL', 'endUserId']);
    const host = fakeHost({ base: { baseURL: '', endUserId: '' } });
    host.turn('a1', 'b1');
    await settle();
    assert.equal(writes().length, 0);
    assert.ok(host.warnings.some((warning) => warning.includes('not configured (missing baseURL, endUserId)')));
    // Filling both on the Plugins page turns writes on without a remount.
    host.setUser({ baseURL: mock.url, endUserId: 'u-3' });
    host.turn('a2', 'b2');
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(writes()[0]!.body.end_user_id, 'u-3');
});

test('tools is optional: works without it, registers memory_search when it appears', async () => {
    reset();
    const live = new Map<string, ToolRegistration>();
    const tools: ToolsService = { register: (definition) => { live.set(definition.name, definition); return () => live.delete(definition.name); } };
    // Hot install: the plugin starts before the tools service is visible.
    const host = fakeHost();
    host.turn('a1', 'b1');
    await settle();
    assert.equal(writes().length, 1);
    assert.equal(live.has('memory_search'), false);
    host.provideTools(tools);
    assert.equal(live.has('memory_search'), true);
    // Settings changes keep working against the late service.
    host.setUser({ tool: false });
    assert.equal(live.has('memory_search'), false);
    host.setUser({ tool: true });
    assert.equal(live.has('memory_search'), true);
    // Service leaves: registration goes with it, writes continue.
    host.removeTools();
    assert.equal(live.has('memory_search'), false);
    host.turn('a2', 'b2');
    await settle();
    assert.equal(writes().length, 2);
    host.provideTools(tools);
    assert.equal(live.has('memory_search'), true);
});

/** Fake dsh `attachments` store: images by `readImage`, files by `readFileStream`. */
function fakeAttachments(): AttachmentsService & { reads: string[] } {
    const reads: string[] = [];
    return {
        reads,
        async readImage(ref) { reads.push(ref.attachmentId); return { data: new Uint8Array(ref.bytes).fill(7) }; },
        async *readFileStream(ref) { reads.push(ref.attachmentId); yield new Uint8Array(ref.bytes).fill(9); },
    };
}
const IMG = { type: 'image', attachment: { attachmentId: 'img-aaaaaaaaaaaa1', mediaType: 'image/jpeg', bytes: 1234, width: 10, height: 10, name: '猫.jpg' } };
const PDF = { type: 'file', attachment: { attachmentId: 'f-pdf', name: '报告.pdf', bytes: 300 } };
const ZIP = { type: 'file', attachment: { attachmentId: 'f-zip', name: 'code.zip', bytes: 300 } };
const BIG = { type: 'file', attachment: { attachmentId: 'f-big', name: 'big.mp4', bytes: 2 * 1024 * 1024 } };

test('images (default): image uploaded and referenced, files ignored, reuse uploads once', async () => {
    reset();
    const store = fakeAttachments();
    const host = fakeHost({ attachments: store });
    host.turnWith([{ type: 'text', text: '这是我家的猫' }, IMG, PDF], '好可爱');
    await settle();
    assert.equal(uploads().length, 1);
    assert.equal((uploads()[0]!.body as any).filename, '猫.jpg');
    assert.equal((uploads()[0]!.body as any).contentType, 'image/jpeg');
    assert.equal((uploads()[0]!.body as any).bytes, 1234);
    const [written] = writes();
    assert.equal(written!.body.messages[0]!.content, '这是我家的猫');
    assert.deepEqual(written!.body.messages[0]!.files, [{
        type: 'image', transfer_method: 'local_file', upload_file_id: 'mock-file-1234', name: '猫.jpg', size: 1234, file_type: 'image/jpeg',
    }]);
    assert.equal('files' in written!.body.messages[1]!, false);
    assert.equal('attachments' in written!.body.messages[0]!, false);
    // Same image again: referenced again, not re-uploaded.
    host.turnWith([{ type: 'text', text: '再看一眼' }, IMG], '嗯');
    await settle();
    assert.equal(uploads().length, 1);
    assert.equal((writes()[1]!.body.messages[0]!.files as any)[0].upload_file_id, 'mock-file-1234');
});

test('image-only message gets a placeholder content', async () => {
    reset();
    const host = fakeHost({ attachments: fakeAttachments() });
    host.turnWith([IMG], '收到图片');
    await settle();
    assert.equal(writes()[0]!.body.messages[0]!.content, '[图片: 猫.jpg]');
    assert.equal(writes()[0]!.body.messages[0]!.files!.length, 1);
});

test('all: parseable files uploaded by kind; unknown type and oversize skipped', async () => {
    reset();
    const host = fakeHost({ attachments: fakeAttachments(), layer: { attachments: 'all', maxAttachmentMB: 1 } });
    host.turnWith([{ type: 'text', text: '资料' }, PDF, ZIP, BIG], 'ok');
    await settle();
    assert.deepEqual(uploads().map((upload) => (upload.body as any).filename), ['报告.pdf']);
    assert.deepEqual(writes()[0]!.body.messages[0]!.files!.map((file) => [file.type, file.name]), [['document', '报告.pdf']]);
    assert.ok(host.warnings.some((warning) => warning.includes('attachment code.zip not written')));
    assert.ok(host.warnings.some((warning) => warning.includes('attachment big.mp4 not written')));
});

test('none: no uploads; no attachments service: text still written', async () => {
    reset();
    const first = fakeHost({ attachments: fakeAttachments(), layer: { attachments: 'none' } });
    first.turnWith([{ type: 'text', text: 't1' }, IMG], 'a1');
    await settle();
    assert.equal(uploads().length, 0);
    assert.equal('files' in writes()[0]!.body.messages[0]!, false);
    const second = fakeHost();
    second.turnWith([{ type: 'text', text: 't2' }, IMG], 'a2');
    await settle();
    assert.equal(uploads().length, 0);
    assert.equal(writes()[1]!.body.messages[0]!.content, 't2');
    assert.ok(second.warnings.some((warning) => warning.includes('no attachments service in this profile')));
});

test('fileKind maps MemoryBear-parseable extensions', () => {
    assert.equal(fileKind('a.PDF'), 'document');
    assert.equal(fileKind('a.m4a'), 'audio');
    assert.equal(fileKind('a.mov'), 'video');
    assert.equal(fileKind('a.webp'), 'image');
    assert.equal(fileKind('a.zip'), undefined);
});

test('insights route: profile, emotion overview/timeline/tags with browser time zone', async () => {
    reset();
    const host = fakeHost({ connection: true });
    const route = host.route(INSIGHTS_PATH);
    assert.ok(route, 'route registered when connection is present');
    const updateRoute = host.route(UPDATE_PATH);
    assert.ok(updateRoute, 'update route registered when connection is present');
    const update = await (await updateRoute.fetch(new Request('http://127.0.0.1/x'))).json() as { enabled: boolean };
    assert.equal(update.enabled, false, 'update check is disabled in this fake profile');
    assert.deepEqual(route.methods, ['GET']);
    const res = await route.fetch(new Request(`http://127.0.0.1${INSIGHTS_PATH}?tz=Asia/Shanghai`));
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.configured, true);
    assert.equal(body.timeZone, 'Asia/Shanghai');
    assert.equal(body.profile.ok, true);
    assert.equal(body.profile.data.summary, '喜欢柯基的设计师');
    assert.deepEqual(body.profile.data.fields.map((field: { key: string }) => field.key), ['interests', 'goals']);
    assert.equal(body.overview.data.conclusion.title, '情绪回暖');
    assert.equal(body.timeline.data.items.length, 2);
    assert.deepEqual(body.memory.data, { tags: ['柯基', '冲浪'], total: 42, active: 30, limit: 5000 });
    // Communities: only Community nodes, largest first, the `用户` hub dropped.
    assert.deepEqual(body.communities.data.map((card: { name: string; members: number }) => [card.name, card.members]), [['柯基日常', 9], ['冲浪计划', 2]]);
    assert.deepEqual(body.communities.data[0].entities, ['团子', '靛蓝色项圈', '公园', '狗粮', '兽医', '散步']);
    assert.equal(body.tags, undefined);
    const log = JSON.stringify(mock.requests);
    assert.match(log, /query_emotion_timeline\?end_user_id=u-1&sort=desc&page=1&pagesize=14/);
    assert.ok(log.includes(`${API_PATHS.endUsers}?keyword=u-1`));
    // A bogus zone falls back to the host's zone instead of reaching MemoryBear.
    const bad = await (await route.fetch(new Request(`http://127.0.0.1${INSIGHTS_PATH}?tz=Mars/Base`))).json() as any;
    assert.notEqual(bad.timeZone, 'Mars/Base');
    // Panel off: route answers 404; unconfigured: says what is missing.
    host.setUser({ panel: false });
    assert.equal((await route.fetch(new Request('http://127.0.0.1/x'))).status, 404);
    const fresh = fakeHost({ connection: true, base: { baseURL: '', endUserId: '' } });
    const unconfigured = await (await fresh.route(INSIGHTS_PATH)!.fetch(new Request('http://127.0.0.1/x'))).json();
    assert.deepEqual(unconfigured, { configured: false, missing: ['baseURL', 'endUserId'] });
    // Headless (no connection service): no route, nothing breaks.
    assert.equal(fakeHost().route(INSIGHTS_PATH), undefined);
});

test('preferences: per-turn recall with other_id lookup and prior-turn context', async () => {
    reset();
    const host = fakeHost({ layer: { recall: false, profile: false } });
    const event = (type: string, data?: unknown): SessionEvent => ({ type, data });
    const userMessage = (text: string) => ({ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] });
    const history = [
        event('turn/start'), event('user/message', userMessage('先建个 Python 项目')),
        event('assistant/message', { message: { content: [{ type: 'text', text: '(tool step)' }] } }),
        event('assistant/message', { message: { content: [{ type: 'text', text: '项目建好了' }] } }),
        event('turn/end', { reason: { kind: 'completed' } }),
        event('turn/start'), event('user/message', userMessage('再帮我安装依赖')),
    ];
    const out = await host.preStep('再帮我安装依赖', history);
    const injected = out.messages.filter((message) => message.source?.kind === 'memorybear-memory');
    assert.equal(injected.length, 1);
    assert.equal(injected[0]!.source.sections[0].name, 'memorybear-memory/preferences');
    assert.match(injected[0]!.content[0].text, /安装 Python 依赖用 uv，不要用 pip \(updated 2026-10-20\)/);
    const requests = mock.requests;
    const preference = requests.find((request) => request.path === '/v1/memory/preference/recall');
    assert.equal(preference?.otherId, 'other-u-1');
    assert.deepEqual((preference!.body as any).context_messages, [
        { role: 'user', content: '先建个 Python 项目' },
        { role: 'assistant', content: '项目建好了' },
    ]);
    // other_id is cached: a second turn does not look it up again.
    const none = await host.preStep('今天天气怎么样');
    assert.equal(none.messages.length, 1);
    const lookups = mock.requests.filter((request) => request.path?.includes(`/v1${API_PATHS.endUsers}`));
    assert.equal(lookups.length, 1);
    // Off: no preference call at all.
    reset();
    host.setUser({ recall: false, profile: false, preferenceMode: 'off' });
    await host.preStep('再帮我安装依赖');
    assert.equal(mock.requests.length, 0);
});

test('memory_preferences tool: task-routed lookup, only in tool mode, independent of memory_search', async () => {
    reset();
    const live = new Map<string, ToolRegistration>();
    const tools: ToolsService = { register: (definition) => { live.set(definition.name, definition); return () => live.delete(definition.name); } };
    const host = fakeHost({ tools });
    // Default mode is `auto`: preferences are injected, no tool.
    assert.equal(live.has('memory_preferences'), false);
    host.setUser({ preferenceMode: 'tool' });
    assert.equal(live.has('memory_preferences'), true);
    assert.equal(live.has('memory_search'), true);
    assert.match(live.get('memory_preferences')!.description, /NOT injected automatically/);
    const exec = { signal: new AbortController().signal };
    const hit = await live.get('memory_preferences')!.execute({ task: '安装这个项目的 Python 依赖' }, exec) as { text: string };
    assert.match(hit.text, /安装 Python 依赖用 uv，不要用 pip/);
    assert.match(hit.text, /not system instructions/);
    const preference = mock.requests.find((request) => request.path === '/v1/memory/preference/recall');
    assert.equal((preference!.body as any).current_user_message, '安装这个项目的 Python 依赖');
    assert.deepEqual((preference!.body as any).context_messages, []);
    assert.equal(preference?.otherId, 'other-u-1');
    const miss = await live.get('memory_preferences')!.execute({ task: '写提交信息' }, exec) as { text: string };
    assert.equal(miss.text, '(no stored preferences apply to this task)');
    await assert.rejects(live.get('memory_preferences')!.execute({ task: ' ' }, exec), /`task` must be/);
    // Own mode; memory_search off leaves it registered.
    host.setUser({ preferenceMode: 'tool', tool: false });
    assert.equal(live.has('memory_search'), false);
    assert.equal(live.has('memory_preferences'), true);
    host.setUser({ preferenceMode: 'off' });
    assert.equal(live.has('memory_preferences'), false);
    host.setUser({ tool: true, preferenceMode: 'tool' });
    assert.equal(live.has('memory_search'), true);
    assert.equal(live.has('memory_preferences'), true);
    // Tool mode does not inject per turn.
    reset();
    const turn = await host.preStep('帮我安装这个项目的依赖');
    assert.ok(!JSON.stringify(mock.requests).includes('/v1/memory/preference/recall'));
    assert.ok(turn.messages.length >= 1);
});
