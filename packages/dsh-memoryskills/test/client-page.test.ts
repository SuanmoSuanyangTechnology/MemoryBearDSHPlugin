/**
 * Smoke test for the browser bundle without a browser: a stub React renders
 * the page to a plain element tree, a fake config scope records mutations, and
 * the test drives the form's handlers the way clicks would.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import type { ClientContext, ConfigScope, ConfigScopeSnapshot } from '@redbearai/dsh-memory-core/client';

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
}) as { apply(ctx: ClientContext): void };

// ── fake client services ──
const base: Record<string, unknown> = {
    portalURL: 'https://testmemoryskills.example', apiKeyEnv: 'MEMORYSKILLS_API_KEY', updateCheck: false,
    profile: true, recall: false, searchSwitch: 'express', tool: true, toolSearchSwitches: ['express', 'quick', 'normal', 'deep'],
    write: true, writeMode: 'batch', writeEveryTurns: 3, writeIdleMinutes: 10,
};
let user: Record<string, unknown> = {};
const scopeListeners = new Set<() => void>();
const mutations: Array<Array<{ op: string; path: string[]; value?: unknown }>> = [];
const scope: ConfigScope = {
    getSnapshot: (): ConfigScopeSnapshot => ({ status: 'ready', writable: true, value: { ...base, ...user }, base, user }),
    subscribe: (listener) => { scopeListeners.add(listener); return () => { scopeListeners.delete(listener); }; },
    async mutate(operations) {
        mutations.push(operations);
        const next = { ...user };
        for (const operation of operations) {
            if (operation.op === 'set') next[operation.path[0]!] = operation.value;
            else delete next[operation.path[0]!];
        }
        user = next;
        for (const listener of scopeListeners) listener();
    },
};
let Page: ((props: { t: (key: string) => string; view?: string }) => unknown) | undefined;
let pageKey: string | undefined;
let credentialConfigured = false;
let credentialWritable = true;
const credentialSets: Array<[string, string]> = [];
const ctx = {
    effect: (effect: () => void | (() => void)) => effect(),
    locale: { register: () => () => {} },
    inject: (_deps: string[], callback: (context: unknown) => void) => callback(ctx),
    remote: {
        $on: () => () => {},
        credentials: {
            describe: async (refs: string[]) => ({ ok: true, value: { [refs[0]!]: { ref: refs[0]!, configured: credentialConfigured, writable: credentialWritable, source: credentialConfigured ? 'store' : undefined } } }),
            set: async (ref: string, value: string) => { credentialSets.push([ref, value]); credentialConfigured = true; return { ok: true }; },
        },
    },
    configForms: {
        get: (namespace: string) => { assert.equal(namespace, 'memoryskills-memory'); return scope; },
    },
    slots: {
        inject: (name: string, callback: () => void) => { assert.equal(name, 'plugins.bundle.config'); callback(); return () => {}; },
        register: (options: { key: string }, component: typeof Page) => { pageKey = options.key; Page = component; return () => {}; },
    },
} as unknown as ClientContext;
mod.apply(ctx);
await new Promise((resolve) => setImmediate(resolve));

// ── tree helpers ──
const render = () => Page!({ t: (key: string) => key, view: 'page' });
function find(node: unknown, predicate: (node: ElementNode) => boolean, out: ElementNode[] = []): ElementNode[] {
    if (node === null || node === undefined || typeof node !== 'object') return out;
    if (Array.isArray(node)) { for (const child of node) find(child, predicate, out); return out; }
    const element = node as ElementNode;
    if (predicate(element)) out.push(element);
    for (const child of element.children ?? []) find(child, predicate, out);
    return out;
}
const byId = (id: string) => find(render(), (node) => node.props?.id === id)[0];
const saveButton = () => find(render(), (node) => node.props?.className === 'ms-save')[0]!;
const texts = (node: unknown) => find(node, () => true).flatMap((element) => (element.children ?? []).filter((child): child is string => typeof child === 'string'));

let passed = 0;
async function run(label: string, fn: () => void | Promise<void>): Promise<void> {
    await fn();
    passed += 1;
    console.log(`ok   ${label}`);
}

await run('page registers on the bundle key while the bundle is mounted', () => {
    assert.equal(pageKey, '@redbearai/dsh-memoryskills');
    assert.equal(Page!({ t: (key) => key, view: 'summary' }), 'summary');
});

await run('controls show current values; no endUserId field; login link follows the Portal', () => {
    assert.equal(byId('ms-portal-url')!.props.value, base.portalURL);
    assert.equal(byId('ms-profile')!.props.checked, true);
    assert.equal(byId('ms-recall')!.props.checked, false);
    assert.equal(byId('ms-search-switch')!.props.value, 'express');
    assert.equal(byId('ms-write-mode')!.props.value, 'batch');
    assert.equal(byId('ms-every')!.props.value, '3');
    assert.equal(byId('ms-end-user'), undefined);
    const link = find(render(), (node) => node.type === 'a')[0]!;
    assert.equal(link.props.href, 'https://testmemoryskills.example/#/login');
    assert.equal(link.props.rel, 'noopener noreferrer');
    assert.equal(byId('ms-api-key')!.props.type, 'password');
    assert.ok(texts(render()).some((text) => text.includes('apiKeyUnset')));
});

await run('several edits save in one mutation, then badges and reset appear', async () => {
    byId('ms-write-mode')!.props.onChange({ target: { value: 'idle' } });
    byId('ms-recall')!.props.onChange({ target: { checked: true } });
    assert.equal(byId('ms-every'), undefined, 'turns-per-write hidden outside batch');
    assert.ok(byId('ms-idle'));
    await saveButton().props.onClick();
    assert.equal(mutations.length, 1);
    assert.equal(JSON.stringify(mutations[0]!.map((op) => [op.op, op.path[0], op.value])), JSON.stringify([['set', 'writeMode', 'idle'], ['set', 'recall', true]]));
    assert.equal(user.writeMode, 'idle');
    assert.ok(texts(render()).includes('overridden'));
    assert.ok(texts(render()).includes('saved'));
});

await run('key: non sk-mem- is rejected; sk-mem- goes to credentials, never to config', async () => {
    byId('ms-api-key')!.props.onChange({ target: { value: 'sk-service-abc' } });
    assert.equal(saveButton().props.disabled, true);
    assert.ok(texts(render()).includes('apiKeyPrefix'));
    byId('ms-api-key')!.props.onChange({ target: { value: '  sk-mem-xyz  ' } });
    assert.equal(saveButton().props.disabled, false);
    const before = mutations.length;
    await saveButton().props.onClick();
    assert.equal(JSON.stringify(credentialSets), JSON.stringify([['MEMORYSKILLS_API_KEY', 'sk-mem-xyz']]));
    assert.equal(mutations.length, before, 'key is not written into config');
    assert.equal(byId('ms-api-key')!.props.value, '');
    assert.ok(texts(render()).some((text) => text.includes('apiKeySet')));
});

await run('unchecking every tool mode blocks save; reset clears an override', async () => {
    for (const mode of ['express', 'quick', 'normal', 'deep']) byId(`ms-tool-${mode}`)!.props.onChange({ target: { checked: false } });
    assert.equal(saveButton().props.disabled, true);
    assert.ok(texts(render()).includes('pickOne'));
    byId('ms-tool-quick')!.props.onChange({ target: { checked: true } });
    assert.equal(saveButton().props.disabled, false);
    await saveButton().props.onClick();
    assert.equal(JSON.stringify(user.toolSearchSwitches), '["quick"]');
    const reset = find(render(), (node) => node.props?.className === 'ms-reset');
    assert.ok(reset.length >= 1);
    const resetTool = find(byIdParent('ms-tool-switches'), (node) => node.props?.className === 'ms-reset')[0]!;
    resetTool.props.onClick();
    await saveButton().props.onClick();
    assert.equal(Object.prototype.hasOwnProperty.call(user, 'toolSearchSwitches'), false);
});

await run('tool off hides its mode list; env-provided key is locked', async () => {
    byId('ms-tool')!.props.onChange({ target: { checked: false } });
    assert.equal(byId('ms-tool-switches'), undefined);
    credentialWritable = false;
    credentialConfigured = true;
    ctx.remote.credentials.describe = async (refs: string[]) => ({ ok: true, value: { [refs[0]!]: { ref: refs[0]!, configured: true, writable: false, source: 'env' } } });
    await scope.mutate([]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(byId('ms-api-key')!.props.disabled, true);
    assert.ok(texts(render()).some((text) => text.includes('apiKeyEnvLocked')));
});

/** The `.ms-field` wrapper that holds the control with this id. */
function byIdParent(id: string): unknown {
    return find(render(), (node) => node.props?.className === 'ms-field' && find(node, (child) => child.props?.id === id).length > 0)[0];
}

console.log(`${passed}/6 passed`);
