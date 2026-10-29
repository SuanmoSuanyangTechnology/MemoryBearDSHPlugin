/**
 * Tests for the hot-install settings namespace refresh.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refreshSettingsNamespace, type SettingsRefreshContext } from '../src/client/settings-refresh.js';

test('refreshSettingsNamespace folds the matching namespace into the mirror', async () => {
    let accepted: { ns: string } | undefined;
    const ctx = {
        remote: {
            settings: {
                describe: async () => ({ ok: true, value: { namespaces: [{ ns: 'other' }, { ns: 'memorybear-memory' }] } }),
            },
        },
        configForms: {
            describe: () => ({ acceptView: (view: { ns: string }) => { accepted = view; } }),
        },
    } as unknown as SettingsRefreshContext;
    await refreshSettingsNamespace(ctx, 'memorybear-memory');
    assert.equal(accepted?.ns, 'memorybear-memory');
});

test('missing or failed settings reads stay silent', async () => {
    const missing = {} as SettingsRefreshContext;
    await refreshSettingsNamespace(missing, 'memorybear-memory');

    const failed = {
        remote: { settings: { describe: async () => { throw new Error('offline'); } } },
        configForms: { describe: () => ({ acceptView: () => { throw new Error('must not be called'); } }) },
    } as unknown as SettingsRefreshContext;
    await refreshSettingsNamespace(failed, 'memorybear-memory');

    const refused = {
        remote: { settings: { describe: async () => ({ ok: false, error: { message: 'no' } }) } },
        configForms: { describe: () => ({ acceptView: () => { throw new Error('must not be called'); } }) },
    } as unknown as SettingsRefreshContext;
    await refreshSettingsNamespace(refused, 'memorybear-memory');
});
