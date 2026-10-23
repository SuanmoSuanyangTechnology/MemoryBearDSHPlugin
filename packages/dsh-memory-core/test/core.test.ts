/**
 * Tests for the shared core helpers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApiUrl, normalizeBaseUrl } from '../src/http/url.js';
import { fieldNamesOf, formatField, parseField, type FieldSpecMap } from '../src/client/form-schema.js';
import { fill } from '../src/client/utils.js';

const SPECS = {
    url: { kind: 'text' },
    enabled: { kind: 'bool' },
    mode: { kind: 'select', options: ['a', 'b'] },
    modes: { kind: 'multi', options: ['a', 'b', 'c'] },
    count: { kind: 'int', min: 1 },
} as const satisfies FieldSpecMap;

test('buildApiUrl joins base, path and query', () => {
    assert.equal(normalizeBaseUrl(' https://host/v1/ '), 'https://host/v1');
    assert.equal(buildApiUrl('https://host/v1/', '/memory/read'), 'https://host/v1/memory/read');
    assert.equal(buildApiUrl('https://host/v1', 'memory/read'), 'https://host/v1/memory/read');
    assert.equal(buildApiUrl('https://host/v1', '/x', { a: 'a b', b: 2, skip: undefined }), 'https://host/v1/x?a=a+b&b=2');
});

test('fieldNamesOf keeps declaration order', () => {
    assert.deepEqual(fieldNamesOf(SPECS), ['url', 'enabled', 'mode', 'modes', 'count']);
});

test('parseField validates by field kind', () => {
    assert.deepEqual(parseField(SPECS, 'enabled', true), { kind: 'set', value: true });
    assert.deepEqual(parseField(SPECS, 'mode', 'b'), { kind: 'set', value: 'b' });
    assert.equal(parseField(SPECS, 'mode', 'z'), undefined);
    assert.deepEqual(parseField(SPECS, 'modes', ['c', 'a']), { kind: 'set', value: ['a', 'c'] });
    assert.equal(parseField(SPECS, 'modes', []), undefined);
    assert.deepEqual(parseField(SPECS, 'count', '2'), { kind: 'set', value: 2 });
    assert.equal(parseField(SPECS, 'count', '1.5'), undefined);
    assert.equal(parseField(SPECS, 'count', '0'), undefined);
    assert.deepEqual(parseField(SPECS, 'url', '  x  '), { kind: 'set', value: 'x' });
    assert.deepEqual(parseField(SPECS, 'url', '  '), { kind: 'clear' });
});

test('formatField maps stored values to draft values', () => {
    assert.equal(formatField(SPECS, 'enabled', undefined), false);
    assert.deepEqual(formatField(SPECS, 'modes', ['a']), ['a']);
    assert.deepEqual(formatField(SPECS, 'modes', undefined), []);
    assert.equal(formatField(SPECS, 'count', 3), '3');
    assert.equal(formatField(SPECS, 'url', null), '');
});

test('fill replaces named placeholders', () => {
    assert.equal(fill('{a} and {b}', { a: 'x', b: 2 }), 'x and 2');
    assert.equal(fill('{missing}', {}), '{missing}');
});
