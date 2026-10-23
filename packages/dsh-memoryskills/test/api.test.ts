/**
 * Route registry tests: Portal paths, URL assembly and JSON-RPC payloads.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    API_PATHS,
    buildApiUrl,
    initializePayload,
    initializedPayload,
    mcpRequest,
    normalizeBaseUrl,
    readMemoryPayload,
    writeRequest,
} from '../src/services/api.js';

test('API_PATHS keeps the MCP trailing slash and REST write path', () => {
    assert.equal(API_PATHS.mcp, '/v1/mcp/memory/');
    assert.equal(API_PATHS.write, '/api/v1/memory/write');
});

test('buildApiUrl joins Portal base and paths', () => {
    assert.equal(normalizeBaseUrl(' https://portal.example/ '), 'https://portal.example');
    assert.equal(buildApiUrl('https://portal.example/', API_PATHS.mcp), 'https://portal.example/v1/mcp/memory/');
    assert.equal(buildApiUrl('https://portal.example', API_PATHS.write), 'https://portal.example/api/v1/memory/write');
    assert.equal(buildApiUrl('https://portal.example', '/x', { page: 1, skip: undefined }), 'https://portal.example/x?page=1');
});

test('JSON-RPC payload builders own the MCP shape', () => {
    assert.deepEqual(initializePayload(7), {
        jsonrpc: '2.0',
        id: 7,
        method: 'initialize',
        params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'memoryskills-memory', version: '0.1.0' },
        },
    });
    assert.deepEqual(initializedPayload(), { jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.deepEqual(readMemoryPayload(8, 'hello', 'quick'), {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: { name: 'read_memory', arguments: { message: 'hello', search_switch: 'quick' } },
    });
});

test('MCP and REST request builders set path, headers and body', () => {
    assert.deepEqual(mcpRequest(initializedPayload(), 'sid-1'), {
        method: 'POST',
        path: '/v1/mcp/memory/',
        json: { jsonrpc: '2.0', method: 'notifications/initialized' },
        headers: { Accept: 'application/json, text/event-stream', 'Mcp-Session-Id': 'sid-1' },
    });
    assert.deepEqual(writeRequest('remember this'), {
        method: 'POST',
        path: '/api/v1/memory/write',
        json: { message: 'remember this' },
    });
});
