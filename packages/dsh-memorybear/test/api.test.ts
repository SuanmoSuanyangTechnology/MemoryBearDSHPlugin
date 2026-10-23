/**
 * Route registry tests: paths, URL assembly and request builders.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    API_PATHS,
    buildApiUrl,
    communityGraphRequest,
    emotionTimelineRequest,
    endUsersRequest,
    normalizeBaseUrl,
    preferenceRecallRequest,
    readSyncRequest,
    writeRequest,
} from '../src/services/api.js';

test('API_PATHS has one unique relative path per route', () => {
    const paths = Object.values(API_PATHS);
    assert.equal(new Set(paths).size, paths.length);
    for (const path of paths) assert.match(path, /^\//);
    assert.equal(API_PATHS.readSync, '/memory/read/sync');
    assert.equal(API_PATHS.write, '/memory/write');
});

test('buildApiUrl joins base, path and query without duplicate slashes', () => {
    assert.equal(normalizeBaseUrl(' https://host/v1/ '), 'https://host/v1');
    assert.equal(buildApiUrl('https://host/v1/', '/memory/read/sync'), 'https://host/v1/memory/read/sync');
    assert.equal(buildApiUrl('https://host/v1/', 'memory/read/sync'), 'https://host/v1/memory/read/sync');
    assert.equal(
        buildApiUrl('https://host/v1', API_PATHS.endUsers, { keyword: 'a b', page: undefined }),
        'https://host/v1/dashboard/end_users?keyword=a+b',
    );
});

test('read/write builders keep the wire field names', () => {
    assert.deepEqual(readSyncRequest({ message: 'hi', searchSwitch: 'quick', endUserId: 'u-1' }), {
        method: 'POST',
        path: '/memory/read/sync',
        json: { message: 'hi', search_switch: 'quick', end_user_id: 'u-1' },
    });
    assert.deepEqual(writeRequest({ messages: [], endUserId: 'u-1', language: 'zh' }), {
        method: 'POST',
        path: '/memory/write',
        json: { messages: [], end_user_id: 'u-1' },
        headers: { 'X-Language-Type': 'zh' },
    });
});

test('query and header builders are centralized', () => {
    assert.deepEqual(endUsersRequest('u-1'), {
        method: 'GET',
        path: '/dashboard/end_users',
        query: { keyword: 'u-1' },
    });
    assert.deepEqual(endUsersRequest('u-1', 'en').headers, { 'X-Language-Type': 'en' });

    assert.deepEqual(preferenceRecallRequest({
        message: 'install deps',
        context: [{ role: 'user', content: 'setup' }],
        otherId: 'other-1',
    }), {
        method: 'POST',
        path: '/memory/preference/recall',
        json: {
            current_user_message: 'install deps',
            context_messages: [{ role: 'user', content: 'setup' }],
        },
        headers: { 'X-End-User-Other-Id': 'other-1' },
    });

    assert.deepEqual(emotionTimelineRequest({ endUserId: 'u-1', timeZone: 'Asia/Shanghai', language: 'zh' }), {
        method: 'GET',
        path: '/memory/emotion-memory/query_emotion_timeline',
        query: { end_user_id: 'u-1', sort: 'desc', page: 1, pagesize: 14 },
        headers: { 'X-Language-Type': 'zh', 'X-Timezone': 'Asia/Shanghai' },
    });

    assert.deepEqual(communityGraphRequest({ endUserId: 'u-1', language: 'en' }), {
        method: 'GET',
        path: '/memory/analytics/community_graph',
        query: { end_user_id: 'u-1' },
        headers: { 'X-Language-Type': 'en' },
    });
});
