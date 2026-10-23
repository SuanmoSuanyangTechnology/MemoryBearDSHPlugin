/**
 * Single source of truth for MemorySkills Portal routes and request payloads.
 *
 * MCP (`read_memory`) and the REST write endpoint are both described here;
 * `portal-client.ts` only performs transport and protocol parsing.
 *
 * @module dsh-memoryskills/services/api
 */
import { CLIENT_VERSION, NAME } from '../constants.js';
import type { QueryParams } from '@redbear/dsh-memory-core';

export { buildApiUrl, normalizeBaseUrl } from '@redbear/dsh-memory-core';
export type { QueryParams, QueryValue } from '@redbear/dsh-memory-core';

/** Portal paths. The MCP trailing slash is required (else 307). */
export const API_PATHS = {
    mcp: '/v1/mcp/memory/',
    write: '/api/v1/memory/write',
} as const;

export type ApiPathName = keyof typeof API_PATHS;


/** One HTTP request before transport concerns (auth, timeout). */
export interface PortalRequest {
    readonly method: 'POST';
    readonly path: string;
    readonly query?: QueryParams;
    readonly json: unknown;
    readonly headers?: Record<string, string>;
}

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params?: unknown;
}

export interface JsonRpcNotification {
    jsonrpc: '2.0';
    method: string;
    params?: unknown;
}

/** MCP `initialize` request payload. */
export function initializePayload(id: number): JsonRpcRequest {
    return {
        jsonrpc: '2.0',
        id,
        method: 'initialize',
        params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: NAME, version: CLIENT_VERSION },
        },
    };
}

/** MCP `notifications/initialized` payload. */
export function initializedPayload(): JsonRpcNotification {
    return { jsonrpc: '2.0', method: 'notifications/initialized' };
}

/** MCP `tools/call` payload for `read_memory`. */
export function readMemoryPayload(id: number, message: string, searchSwitch: string): JsonRpcRequest {
    return {
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: 'read_memory', arguments: { message, search_switch: searchSwitch } },
    };
}

/** POST to the MCP endpoint, optionally resuming a session. */
export function mcpRequest(payload: JsonRpcRequest | JsonRpcNotification, sessionId?: string): PortalRequest {
    return {
        method: 'POST',
        path: API_PATHS.mcp,
        json: payload,
        headers: {
            Accept: 'application/json, text/event-stream',
            ...(sessionId === undefined ? {} : { 'Mcp-Session-Id': sessionId }),
        },
    };
}

/** POST `/api/v1/memory/write` with one text message. */
export function writeRequest(message: string): PortalRequest {
    return { method: 'POST', path: API_PATHS.write, json: { message } };
}
