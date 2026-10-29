/**
 * Smoke test for the browser bundle without a browser: a stub React renders
 * the page to a plain element tree, a fake settings scope records mutations,
 * and the test drives the form's handlers the way clicks would.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import type { ConfigScope, ConfigScopeSnapshot } from '@redbearai/dsh-memory-core/client';
import type { MemoryBearClientContext, SidebarTabDefinition } from '../src/client/types.js';

// ── load the built bundle through a fake module loader ──
interface ElementNode {
    type: unknown;
    props: Record<string, any>;
    children: unknown[];
}

function flatten(value: unknown): unknown[] {
    return Array.isArray(value) ? value.flatMap(flatten) : [value];
}

const createElement = (type: unknown, props?: Record<string, any> | null, ...children: unknown[]): unknown => {
    const merged: Record<string, any> = { ...(props ?? {}) };
    if (children.length > 0) merged.children = children.length <= 1 ? children[0] : children;
    if (typeof type === 'function') return (type as (props: Record<string, unknown>) => unknown)(merged);
    return { type, props: merged, children: flatten(merged.children) } satisfies ElementNode;
};

const React = {
    createElement,
    useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
    useEffect: () => {},
    useState: <T,>(initial: T): [T, (next: T) => void] => [initial, () => {}],
};
const jsxRuntime = {
    jsx: (type: unknown, props: Record<string, any>, key?: unknown) => createElement(type, key === undefined ? props : { ...props, key }),
    jsxs: (type: unknown, props: Record<string, any>, key?: unknown) => createElement(type, key === undefined ? props : { ...props, key }),
    Fragment: 'Fragment',
};

let factory: ((requireModule: (id: string) => unknown) => unknown) | undefined;
const sandbox = {
    window: { __ModuleLoader__: { load: ({ factory: loaded }: { factory: typeof factory }) => { factory = loaded; } } },
    document: undefined,
    console,
};
vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), sandbox);
assert.ok(factory, 'client bundle called the module loader');
const mod = factory((id: string) => {
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return jsxRuntime;
    throw new Error(`unexpected require ${id}`);
}) as { apply(ctx: MemoryBearClientContext): void };

// ── fake client services ──
const base: Record<string, unknown> = {
    baseURL: 'https://test/v1', endUserId: 'u-1', apiKeyEnv: 'MEMORY_SERVICE_API_KEY',
    profile: true, recall: false, searchSwitch: 'express', toolSearchSwitches: ['express', 'quick'],
    write: true, writeMode: 'turn', writeEveryTurns: 3, writeIdleMinutes: 10,
};
let user: Record<string, unknown> = {};
let revision = 1;
const scopeListeners = new Set<() => void>();
const mutations: Array<Array<{ op: string; path: string[]; value?: unknown }>> = [];
const scope: ConfigScope = {
    getSnapshot: (): ConfigScopeSnapshot => ({ status: 'ready', writable: true, value: { ...base, ...user }, base, user, revision, mode: 'host' }),
    subscribe: (listener) => { scopeListeners.add(listener); return () => { scopeListeners.delete(listener); }; },
    async mutate(operations) {
        mutations.push(operations);
        const next = { ...user };
        for (const operation of operations) {
            if (operation.op === 'set') next[operation.path[0]!] = operation.value;
            else delete next[operation.path[0]!];
        }
        user = next;
        revision += 1;
        for (const listener of scopeListeners) listener();
    },
};
let Page: ((props: { t: (key: string) => string; view?: string }) => unknown) | undefined;
let Panel: unknown;
let panelType: SidebarTabDefinition | undefined;
const credentialSets: string[] = [];
const ctx = {
    effect: (effect: () => void | (() => void)) => effect(),
    locale: { register: () => () => {}, bind: () => (key: string) => key },
    // Optional right sidebar: the panel registers its tab type and body slot.
    inject: (deps: string[], callback: (context: unknown) => void) => {
        assert.equal(JSON.stringify(deps), '["sidebarRightTabs"]');
        callback({
            ...ctx,
            sidebarRightTabs: { register: (definition: SidebarTabDefinition) => { panelType = definition; return () => {}; } },
            slots: {
                inject: (name: string, fn: () => void) => { assert.equal(name, 'sidebar.right.pane.tab'); fn(); },
                register: (options: { key: string }, component: unknown) => { assert.equal(options.key, '@redbearai/dsh-memorybear/panel'); Panel = component; return () => {}; },
            },
        });
    },
    remote: {
        $on: () => () => {},
        credentials: {
            describe: async (refs: string[]) => ({ ok: true, value: { [refs[0]!]: { ref: refs[0]!, configured: true, writable: false, source: 'env' } } }),
            set: async (ref: string) => { credentialSets.push(ref); return { ok: true }; },
        },
    },
    configForms: {
        get: (entryId: string) => { assert.equal(entryId, 'memorybear-memory'); return scope; },
    },
    slots: {
        inject: (name: string, callback: () => void) => { assert.equal(name, 'plugins.bundle.config'); callback(); return () => {}; },
        register: (options: { key: string }, component: typeof Page) => { assert.equal(options.key, '@redbearai/dsh-memorybear'); Page = component; return () => {}; },
    },
} as unknown as MemoryBearClientContext;
mod.apply(ctx);
assert.ok(Page, 'page registered');
assert.ok(Panel, 'memory panel body registered');
assert.equal(panelType?.id, '@redbearai/dsh-memorybear/panel');
assert.equal(panelType?.kind, 'memorybear');
assert.equal(panelType?.title(), 'panelTitle');
const t = (key: string) => key;
await new Promise((resolve) => setTimeout(resolve, 10)); // credential describe settles

// ── tree helpers ──
const render = () => Page!({ t, view: 'page' });
function find(node: unknown, predicate: (node: ElementNode) => boolean, out: ElementNode[] = []): ElementNode[] {
    if (node === null || node === undefined || typeof node !== 'object') return out;
    if (Array.isArray(node)) { for (const child of node) find(child, predicate, out); return out; }
    const element = node as ElementNode;
    if (predicate(element)) out.push(element);
    for (const child of element.children ?? []) find(child, predicate, out);
    return out;
}
function text(node: unknown): string {
    if (node === null || node === undefined || node === false) return '';
    if (typeof node !== 'object') return String(node);
    const element = node as ElementNode;
    return (element.children ?? []).map(text).join(' ');
}
const byId = (id: string) => find(render(), (node) => node.props?.id === id && (node.type === 'input' || node.type === 'select'))[0];
const saveButton = () => find(render(), (node) => node.props?.className === 'mb-save')[0]!;

assert.equal(Page!({ t, view: 'summary' }), 'summary');

let tree = render();
for (const id of ['mb-profile', 'mb-recall', 'mb-search-switch', 'mb-tool-express', 'mb-write', 'mb-base-url', 'mb-end-user', 'mb-api-key', 'mb-write-mode']) {
    assert.ok(byId(id), `control ${id} rendered`);
}
assert.equal(byId('mb-profile')!.props.checked, true);
assert.equal(byId('mb-recall')!.props.checked, false);
assert.equal(byId('mb-tool-normal')!.props.checked, false);
assert.equal(byId('mb-api-key')!.props.disabled, true, 'env-provided key is locked');
assert.equal(saveButton().props.disabled, true, 'nothing to save yet');
console.log('ok - renders all controls with current values');

// Edit: recall on, mode quick, add deep to tool modes, batch every 2.
byId('mb-recall')!.props.onChange({ target: { checked: true } });
byId('mb-search-switch')!.props.onChange({ target: { value: 'quick' } });
byId('mb-write-mode')!.props.onChange({ target: { value: 'batch' } });
tree = render();
assert.ok(byId('mb-every'), 'batch shows turns-per-write');
byId('mb-every')!.props.onChange({ target: { value: '2' } });
tree = render();
assert.equal(saveButton().props.disabled, false);
await saveButton().props.onClick();
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(mutations.length, 1, 'one atomic mutation');
assert.deepEqual(JSON.parse(JSON.stringify(user)), {
    recall: true, searchSwitch: 'quick',
    writeMode: 'batch', writeEveryTurns: 2,
});
assert.deepEqual(credentialSets, [], 'blank key writes nothing');
assert.match(text(render()), /saved/);
console.log('ok - edits save as one mutation with the right values');

// Unchecking every tool mode blocks the save.
for (const mode of ['express', 'quick']) byId(`mb-tool-${mode}`)!.props.onChange({ target: { checked: false } });
tree = render();
assert.equal(saveButton().props.disabled, true, 'empty tool modes is invalid');
assert.match(text(tree), /pickOne/);
console.log('ok - empty tool mode list is rejected');

// An override shows a reset button; turning write off hides the mode controls.
let resetBtn: ElementNode | undefined;
(function walk(node: unknown) {
    if (node === null || node === undefined || typeof node !== 'object') return;
    const element = node as ElementNode;
    if (element.type === 'button' && element.props.className === 'mb-reset' && !resetBtn) resetBtn = element;
    (element.children ?? []).forEach(walk);
})(render());
assert.ok(resetBtn, 'an override shows a reset button');
console.log('ok - overrides show a reset control');

byId('mb-write')!.props.onChange({ target: { checked: false } });
assert.equal(byId('mb-write-mode'), undefined, 'write off hides mode');

// Preference group: its own controls, advanced fields validate as integers.
tree = render();
for (const id of ['mb-preference-mode', 'mb-pref-context', 'mb-pref-timeout']) {
    assert.ok(byId(id), `preference control ${id} rendered`);
}
assert.equal(byId('mb-end-user-other'), undefined, 'other_id is looked up, not configured');
byId('mb-pref-context')!.props.onChange({ target: { value: '-1' } });
assert.equal(byId('mb-pref-context')!.props['aria-invalid'], true, 'negative context count is invalid');
byId('mb-pref-context')!.props.onChange({ target: { value: '0' } });
assert.equal(byId('mb-pref-context')!.props['aria-invalid'], undefined, '0 context messages is allowed');
byId('mb-pref-timeout')!.props.onChange({ target: { value: '1.5' } });
assert.equal(byId('mb-pref-timeout')!.props['aria-invalid'], true, 'timeout must be a whole number');
console.log('ok - preference group renders and validates');
console.log('all client page tests passed');
