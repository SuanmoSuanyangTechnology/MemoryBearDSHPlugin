/**
 * Smoke test for client.js without a browser: a stub React renders the page
 * to a plain element tree, a fake settings scope records mutations, and the
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
    baseURL: 'https://test/v1', endUserId: 'u-1', apiKeyEnv: 'MEMORY_SERVICE_API_KEY',
    profile: true, recall: false, searchSwitch: 'express', toolSearchSwitches: ['express', 'quick'],
    write: true, writeMode: 'turn', writeEveryTurns: 3, writeIdleMinutes: 10,
};
let user = {};
let revision = 1;
const scopeListeners = new Set();
const mutations = [];
const scope = {
    getSnapshot: () => ({ status: 'ready', writable: true, value: { ...base, ...user }, base, user, revision, mode: 'host' }),
    subscribe: (l) => { scopeListeners.add(l); return () => scopeListeners.delete(l); },
    async mutate(ops) {
        mutations.push(ops);
        const next = { ...user };
        for (const op of ops) {
            if (op.op === 'set') next[op.path[0]] = op.value;
            else delete next[op.path[0]];
        }
        user = next;
        revision += 1;
        for (const l of scopeListeners) l();
    },
};
let Page;
const credentialSets = [];
const ctx = {
    effect: (fn) => fn(),
    locale: { register: () => () => {} },
    remote: {
        $on: () => () => {},
        credentials: {
            describe: async (refs) => ({ ok: true, value: { [refs[0]]: { configured: true, writable: false, source: 'env' } } }),
            set: async (ref, v) => { credentialSets.push(ref); return { ok: true }; },
        },
    },
    configForms: {
        get: (entryId) => { assert.equal(entryId, 'memorybear-memory'); return scope; },
        whileServed: (namespaces, register) => { assert.equal(JSON.stringify(namespaces), '["memorybear-memory"]'); return register(new Set(namespaces)); },
    },
    slots: {
        inject: (name, fn) => { assert.equal(name, 'plugins.bundle.config'); fn(); },
        register: (opts, Comp) => { assert.equal(opts.key, '@kesun5/dsh-memorybear'); Page = Comp; },
    },
};
mod.apply(ctx);
assert.ok(Page, 'page registered');
const t = (k) => k;
await new Promise((r) => setTimeout(r, 10)); // credential describe settles

// ── tree helpers ──
const render = () => Page({ t, view: 'page' });
function find(node, id) {
    if (!node || typeof node !== 'object') return undefined;
    if (node.props?.id === id && (node.type === 'input' || node.type === 'select')) return node;
    for (const c of node.children ?? []) {
        const hit = find(c, id);
        if (hit) return hit;
    }
    return undefined;
}
function text(node) {
    if (node == null || node === false) return '';
    if (typeof node !== 'object') return String(node);
    return (node.children ?? []).map(text).join(' ');
}
const saveButton = (tree) => {
    let hit;
    (function walk(n) {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'button' && n.props.className === 'mb-save') hit = n;
        (n.children ?? []).forEach(walk);
    })(tree);
    return hit;
};

assert.equal(Page({ t, view: 'summary' }), 'summary');

let tree = render();
for (const id of ['mb-profile', 'mb-recall', 'mb-search-switch', 'mb-tool-express', 'mb-write', 'mb-base-url', 'mb-end-user', 'mb-api-key', 'mb-write-mode']) {
    assert.ok(find(tree, id), `control ${id} rendered`);
}
assert.equal(find(tree, 'mb-profile').props.checked, true);
assert.equal(find(tree, 'mb-recall').props.checked, false);
assert.equal(find(tree, 'mb-tool-normal').props.checked, false);
assert.equal(find(tree, 'mb-api-key').props.disabled, true, 'env-provided key is locked');
assert.equal(saveButton(tree).props.disabled, true, 'nothing to save yet');
console.log('ok - renders all controls with current values');

// Edit: recall on, mode quick, add deep to tool modes, batch every 2.
find(tree, 'mb-recall').props.onChange({ target: { checked: true } });
find(render(), 'mb-search-switch').props.onChange({ target: { value: 'quick' } });
find(render(), 'mb-tool-deep').props.onChange({ target: { checked: true } });
find(render(), 'mb-write-mode').props.onChange({ target: { value: 'batch' } });
tree = render();
assert.ok(find(tree, 'mb-every'), 'batch shows turns-per-write');
find(tree, 'mb-every').props.onChange({ target: { value: '2' } });
tree = render();
assert.equal(saveButton(tree).props.disabled, false);
await saveButton(tree).props.onClick();
await new Promise((r) => setTimeout(r, 10));
assert.equal(mutations.length, 1, 'one atomic mutation');
assert.deepEqual(JSON.parse(JSON.stringify(user)), {
    recall: true, searchSwitch: 'quick', toolSearchSwitches: ['express', 'quick', 'deep'],
    writeMode: 'batch', writeEveryTurns: 2,
});
assert.deepEqual(credentialSets, [], 'blank key writes nothing');
assert.match(text(render()), /saved/);
console.log('ok - edits save as one mutation with the right values');

// Unchecking every tool mode blocks the save.
for (const m of ['express', 'quick', 'deep']) find(render(), `mb-tool-${m}`).props.onChange({ target: { checked: false } });
tree = render();
assert.equal(saveButton(tree).props.disabled, true, 'empty tool modes is invalid');
assert.match(text(tree), /pickOne/);
console.log('ok - empty tool mode list is rejected');

// An override shows a reset button; turning write off hides the mode controls.
let resetBtn;
(function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'button' && n.props.className === 'mb-reset' && !resetBtn) resetBtn = n;
    (n.children ?? []).forEach(walk);
})(render());
assert.ok(resetBtn, 'an override shows a reset button');
console.log('ok - overrides show a reset control');

find(render(), 'mb-write').props.onChange({ target: { checked: false } });
assert.equal(find(render(), 'mb-write-mode'), undefined, 'write off hides mode');
console.log('all client page tests passed');
