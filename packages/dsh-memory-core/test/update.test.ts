/**
 * Tests for the notify-only update checker and version comparison.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareVersions, createUpdateChecker, isNewerVersion } from '../src/update.js';
import { updateCommand } from '../src/client/update.js';

test('compareVersions follows semantic version ordering', () => {
    assert.ok(compareVersions('0.2.2', '0.2.1') > 0);
    assert.equal(compareVersions('0.2.2', '0.2.2'), 0);
    assert.equal(compareVersions('v0.2.2', '0.2.2'), 0);
    assert.ok(compareVersions('0.2.2', '0.3.0') < 0);
    assert.ok(compareVersions('0.2.2-beta.1', '0.2.2') < 0);
    assert.ok(compareVersions('0.2.2-beta.2', '0.2.2-beta.1') > 0);
    assert.ok(compareVersions('0.2.2-beta', '0.2.2-beta.1') < 0);
    assert.equal(compareVersions('not-a-version', '0.2.2'), 0);
    assert.equal(isNewerVersion('0.2.3', '0.2.2'), true);
    assert.equal(isNewerVersion('0.2.2', '0.2.2'), false);
});

test('disabled checks never touch the registry', async () => {
    let calls = 0;
    const checker = createUpdateChecker({
        packageName: '@redbearai/dsh-memorybear',
        currentVersion: '0.2.2',
        isEnabled: () => false,
        fetchImpl: (async () => { calls += 1; return { ok: true, json: async () => ({ version: '9.9.9' }) }; }) as unknown as typeof fetch,
    });
    assert.deepEqual(await checker.check(), { enabled: false, current: '0.2.2', available: false });
    assert.equal(calls, 0);
});

test('an available release includes the install spec and is cached', async () => {
    let calls = 0;
    const checker = createUpdateChecker({
        packageName: '@redbearai/dsh-memorybear',
        currentVersion: '0.2.2',
        isEnabled: () => true,
        now: () => Date.parse('2026-10-29T00:00:00Z'),
        fetchImpl: (async () => {
            calls += 1;
            return { ok: true, json: async () => ({ version: '0.2.3' }) };
        }) as unknown as typeof fetch,
    });
    const first = await checker.check();
    assert.deepEqual(first, {
        enabled: true,
        current: '0.2.2',
        latest: '0.2.3',
        available: true,
        spec: '@redbearai/dsh-memorybear@0.2.3',
        checkedAt: '2026-10-29T00:00:00.000Z',
    });
    const second = await checker.check();
    assert.equal(second, first);
    assert.equal(calls, 1);
    await checker.check(true);
    assert.equal(calls, 2);
});

test('registry failures are returned, never thrown', async () => {
    const checker = createUpdateChecker({
        packageName: '@redbearai/dsh-memorybear',
        currentVersion: '0.2.2',
        isEnabled: () => true,
        fetchImpl: (async () => { throw new Error('offline'); }) as unknown as typeof fetch,
    });
    const status = await checker.check();
    assert.equal(status.enabled, true);
    assert.equal(status.available, false);
    assert.match(status.error ?? '', /offline/);
});

test('a stale cache is refreshed after the interval', async () => {
    let calls = 0;
    let clock = 0;
    const checker = createUpdateChecker({
        packageName: '@redbearai/dsh-memorybear',
        currentVersion: '0.2.2',
        isEnabled: () => true,
        intervalMs: 1_000,
        now: () => clock,
        fetchImpl: (async () => {
            calls += 1;
            return { ok: true, json: async () => ({ version: calls === 1 ? '0.2.2' : '0.2.3' }) };
        }) as unknown as typeof fetch,
    });
    assert.equal((await checker.check()).available, false);
    clock = 500;
    assert.equal((await checker.check()).available, false);
    assert.equal(calls, 1);
    clock = 1_500;
    assert.equal((await checker.check()).available, true);
    assert.equal(calls, 2);
});

test('updateCommand names the package, version and profile placeholder', () => {
    const command = updateCommand('@redbearai/dsh-memorybear', '0.3.0');
    assert.match(command, /dsh plugin --profile PROFILE remove @redbearai\/dsh-memorybear/);
    assert.match(command, /add @redbearai\/dsh-memorybear@0\.3\.0/);
});
