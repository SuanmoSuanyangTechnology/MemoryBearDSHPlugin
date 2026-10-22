/**
 * Smoke test for client.js without a browser: a stub React renders the page
 * to a plain element tree, a fake config scope records mutations, and the
 * test drives the form's handlers the way clicks would.
 *
 *   node test/client-page.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// ── load the bundle through a fake module loader ──
let factory;
const React = {
    // Function components render eagerly, so the tree holds only host elements.
    createElement: (type, props, ...children) => (typeof type === 'function'
        ? type({ ...(props ?? {}), children: children.length <= 1 ? children[0] : children })
        : { type, props: props ?? {}, children: children.flat() }),
    useSyncExternalStore: (_sub, get) => get(),
    useEffect: () => {},
};
const sandbox = {
    window: { __ModuleLoader__: { load: ({ factory: f }) => { factory = f; } } },
    document: undefined,
    console,
};
vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), sandbox);
const mod = factory((id) => {
    if (id === 'react') return React;
    throw new Error(`unexpected require ${id}`);
});

// ── fake client services ──
const base = {
    portalURL: 'https://testmemoryskills.example', apiKeyEnv: 'MEMORYSKILLS_API_KEY',
    profile: true, recall: false, searchSwitch: 'express', tool: true, toolSearchSwitches: ['express', 'quick', 'normal', 'deep'],
    write: true, writeMode: 'batch', writeEveryTurns: 3, writeIdleMinutes: 10,
};
let user = {};
const scopeListeners = new Set();
const mutations = [];
const scope = {
    getSnapshot: () => ({ status: 'ready', writable: true, value: { ...base, ...user }, base, user }),
    subscribe: (l) => { scopeListeners.add(l); return () => scopeListeners.delete(l); },
    async mutate(ops) {
        mutations.push(ops);
        const next = { ...user };
        for (const op of ops) {
            if (op.op === 'set') next[op.path[0]] = op.value;
            else delete next[op.path[0]];
        }
        user = next;
        for (const l of scopeListeners) l();
    },
};
let Page;
let pageKey;
let servedNs;
let credentialConfigured = false;
let credentialWritable = true;
const credentialSets = [];
const ctx = {
    effect: (fn) => fn(),
    locale: { register: () => () => {} },
    remote: {
        $on: () => () => {},
        credentials: {
            describe: async (refs) => ({ ok: true, value: { [refs[0]]: { configured: credentialConfigured, writable: credentialWritable, source: credentialConfigured ? 'store' : undefined } } }),
            set: async (ref, value) => { credentialSets.push([ref, value]); credentialConfigured = true; return { ok: true }; },
        },
    },
    configForms: {
        get: (ns) => { assert.equal(ns, 'memoryskills-memory'); return scope; },
        whileServed: (nss, fn) => { servedNs = nss; return fn(); },
    },
    slots: {
        inject: (name, fn) => { assert.equal(name, 'plugins.bundle.config'); return fn(); },
        register: (opts, Comp) => { pageKey = opts.key; Page = Comp; return () => {}; },
    },
};
mod.apply(ctx);
await new Promise((r) => setImmediate(r));

// ── tree helpers ──
const render = () => Page({ t: (k) => k, view: 'page' });
function find(node, pred, out = []) {
    if (node === null || node === undefined || typeof node !== 'object') return out;
    if (Array.isArray(node)) { for (const n of node) find(n, pred, out); return out; }
    if (pred(node)) out.push(node);
    for (const c of node.children ?? []) find(c, pred, out);
    return out;
}
const byId = (id) => find(render(), (n) => n.props?.id === id)[0];
const saveButton = () => find(render(), (n) => n.props?.className === 'ms-save')[0];
const texts = (node) => find(node, () => true).flatMap((n) => (n.children ?? []).filter((c) => typeof c === 'string'));

let passed = 0;
async function test(label, fn) {
    await fn();
    passed += 1;
    console.log(`ok   ${label}`);
}

await test('page registers on the bundle key while the entry is served', () => {
    assert.equal(pageKey, '@kesun5/dsh-memoryskills');
    assert.equal(JSON.stringify(servedNs), '["memoryskills-memory"]');
    assert.equal(Page({ t: (k) => k, view: 'summary' }), 'summary');
});

await test('controls show current values; no endUserId field; login link follows the Portal', () => {
    assert.equal(byId('ms-portal-url').props.value, base.portalURL);
    assert.equal(byId('ms-profile').props.checked, true);
    assert.equal(byId('ms-recall').props.checked, false);
    assert.equal(byId('ms-search-switch').props.value, 'express');
    assert.equal(byId('ms-write-mode').props.value, 'batch');
    assert.equal(byId('ms-every').props.value, '3');
    assert.equal(byId('ms-end-user'), undefined);
    const link = find(render(), (n) => n.type === 'a')[0];
    assert.equal(link.props.href, 'https://testmemoryskills.example/#/login');
    assert.equal(link.props.rel, 'noopener noreferrer');
    assert.equal(byId('ms-api-key').props.type, 'password');
    assert.ok(texts(render()).some((s) => s.includes('apiKeyUnset')));
});

await test('several edits save in one mutation, then badges and reset appear', async () => {
    byId('ms-write-mode').props.onChange({ target: { value: 'idle' } });
    byId('ms-recall').props.onChange({ target: { checked: true } });
    assert.equal(byId('ms-every'), undefined, 'turns-per-write hidden outside batch');
    assert.ok(byId('ms-idle'));
    await saveButton().props.onClick();
    assert.equal(mutations.length, 1);
    assert.equal(JSON.stringify(mutations[0].map((o) => [o.op, o.path[0], o.value])), JSON.stringify([['set', 'writeMode', 'idle'], ['set', 'recall', true]]));
    assert.equal(user.writeMode, 'idle');
    assert.ok(texts(render()).includes('overridden'));
    assert.ok(texts(render()).includes('saved'));
});

await test('key: non sk-mem- is rejected; sk-mem- goes to credentials, never to config', async () => {
    byId('ms-api-key').props.onChange({ target: { value: 'sk-service-abc' } });
    assert.equal(saveButton().props.disabled, true);
    assert.ok(texts(render()).includes('apiKeyPrefix'));
    byId('ms-api-key').props.onChange({ target: { value: '  sk-mem-xyz  ' } });
    assert.equal(saveButton().props.disabled, false);
    const before = mutations.length;
    await saveButton().props.onClick();
    assert.equal(JSON.stringify(credentialSets), JSON.stringify([['MEMORYSKILLS_API_KEY', 'sk-mem-xyz']]));
    assert.equal(mutations.length, before, 'key is not written into config');
    assert.equal(byId('ms-api-key').props.value, '');
    assert.ok(texts(render()).some((s) => s.includes('apiKeySet')));
});

await test('unchecking every tool mode blocks save; reset clears an override', async () => {
    for (const m of ['express', 'quick', 'normal', 'deep']) byId(`ms-tool-${m}`).props.onChange({ target: { checked: false } });
    assert.equal(saveButton().props.disabled, true);
    assert.ok(texts(render()).includes('pickOne'));
    byId('ms-tool-quick').props.onChange({ target: { checked: true } });
    assert.equal(saveButton().props.disabled, false);
    await saveButton().props.onClick();
    assert.equal(JSON.stringify(user.toolSearchSwitches), '["quick"]');
    const reset = find(render(), (n) => n.props?.className === 'ms-reset');
    assert.ok(reset.length >= 1);
    const resetTool = find(byIdParent('ms-tool-switches'), (n) => n.props?.className === 'ms-reset')[0];
    resetTool.props.onClick();
    await saveButton().props.onClick();
    assert.equal(Object.prototype.hasOwnProperty.call(user, 'toolSearchSwitches'), false);
});

await test('tool off hides its mode list; env-provided key is locked', async () => {
    byId('ms-tool').props.onChange({ target: { checked: false } });
    assert.equal(byId('ms-tool-switches'), undefined);
    credentialWritable = false;
    credentialConfigured = true;
    ctx.remote.credentials.describe = async (refs) => ({ ok: true, value: { [refs[0]]: { configured: true, writable: false, source: 'env' } } });
    await scope.mutate([]);
    await new Promise((r) => setImmediate(r));
    assert.equal(byId('ms-api-key').props.disabled, true);
    assert.ok(texts(render()).some((s) => s.includes('apiKeyEnvLocked')));
});

/** The `.ms-field` wrapper that holds the control with this id. */
function byIdParent(id) {
    return find(render(), (n) => n.props?.className === 'ms-field' && find(n, (c) => c.props?.id === id).length > 0)[0];
}

console.log(`${passed}/6 passed`);
