/**
 * MemorySkills Portal client: one MCP streamable-HTTP session for `read_memory`
 * plus the REST write endpoint.
 *
 * @module dsh-memoryskills/services/portal-client
 */
import type { ConfigSnapshot } from '../config.js';
import {
    buildApiUrl,
    initializePayload,
    initializedPayload,
    mcpRequest,
    normalizeBaseUrl,
    readMemoryPayload,
    writeRequest,
    type PortalRequest,
} from './api.js';

/** HTTP error that keeps the status, so callers can tell auth/quota/rate errors apart. */
export class PortalHttpError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(`HTTP ${status}: ${message}`);
        this.name = 'PortalHttpError';
        this.status = status;
    }
}

interface JsonRpcError {
    message?: string;
}

export interface JsonRpcReply {
    id?: number;
    result?: {
        content?: Array<{ type?: string; text?: string }>;
        structuredContent?: { answer?: unknown };
        isError?: boolean;
    };
    error?: JsonRpcError;
}

/** Parse one MCP streamable-HTTP response body: plain JSON, or SSE with JSON-RPC messages. */
export function parseRpcBody(contentType: string, body: string, id: number): JsonRpcReply {
    if (!contentType.includes('text/event-stream')) return JSON.parse(body) as JsonRpcReply;
    for (const event of body.split(/\r?\n\r?\n/)) {
        const data = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n');
        if (!data) continue;
        const message = JSON.parse(data) as JsonRpcReply;
        if (message.id === id) return message;
    }
    throw new Error('MCP response carried no reply for this request');
}

export interface ReadMemoryOptions {
    searchSwitch?: string;
    timeoutMs?: number;
}

/** Portal client used by the recall and tool features. */
export interface PortalClient {
    /** Call `read_memory` and return its `answer` text ('' when nothing matched). */
    readMemory(message: string, signal?: AbortSignal, options?: ReadMemoryOptions): Promise<string>;
    /** POST `/api/v1/memory/write` with one text message. */
    writeMemory(cfg: ConfigSnapshot, key: string, message: string): Promise<unknown>;
    /** Forget cached MCP sessions (config change). */
    reset(): void;
}

/** `url|key` -> pending MCP session id. */
type SessionCache = Map<string, Promise<string | undefined>>;

/**
 * Create the Portal client.
 *
 * @param getConfig - current config snapshot.
 * @param resolveKey - credential resolver for the `sk-mem-` key.
 */
export function createPortalClient(
    getConfig: () => ConfigSnapshot,
    resolveKey: (cfg: ConfigSnapshot) => Promise<string | undefined>,
): PortalClient {
    const sessions: SessionCache = new Map();
    let nextId = 1;

    /** Send one request built by `api.ts`. */
    async function send(base: string, key: string, request: PortalRequest, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${key}`,
            ...request.headers,
        };
        let body: BodyInit | undefined;
        if (request.json !== undefined) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(request.json);
        }
        const timeout = AbortSignal.timeout(timeoutMs);
        return fetch(buildApiUrl(base, request.path, request.query), {
            method: request.method,
            headers,
            body,
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
    }

    async function initialize(base: string, key: string, timeoutMs: number, signal?: AbortSignal): Promise<string | undefined> {
        const id = nextId++;
        const res = await send(base, key, mcpRequest(initializePayload(id)), timeoutMs, signal);
        const body = await res.text();
        if (!res.ok) throw new PortalHttpError(res.status, body.slice(0, 200));
        const reply = parseRpcBody(res.headers.get('content-type') ?? '', body, id);
        if (reply.error) throw new Error(`MCP initialize failed: ${reply.error.message}`);
        const sessionId = res.headers.get('mcp-session-id') ?? undefined;
        const ack = await send(base, key, mcpRequest(initializedPayload(), sessionId), timeoutMs, signal);
        await ack.arrayBuffer();
        return sessionId;
    }

    async function readMemory(message: string, signal?: AbortSignal, options: ReadMemoryOptions = {}): Promise<string> {
        const cfg = getConfig();
        const key = await resolveKey(cfg);
        if (!key) throw new Error(`no API key under ${cfg.apiKeyEnv}`);
        const base = normalizeBaseUrl(cfg.portalURL);
        const timeoutMs = options.timeoutMs ?? cfg.recallTimeoutMs;
        const cacheKey = `${base}|${key}`;
        for (let attempt = 0; attempt < 2; attempt += 1) {
            let pendingSession = sessions.get(cacheKey);
            if (!pendingSession) {
                pendingSession = initialize(base, key, timeoutMs, signal);
                sessions.set(cacheKey, pendingSession);
                pendingSession.catch(() => sessions.delete(cacheKey));
            }
            const sessionId = await pendingSession;
            const id = nextId++;
            const request = readMemoryPayload(id, message, options.searchSwitch ?? cfg.searchSwitch);
            const res = await send(base, key, mcpRequest(request, sessionId), timeoutMs, signal);
            const body = await res.text();
            if ((res.status === 404 || res.status === 400) && sessionId && attempt === 0) {
                sessions.delete(cacheKey); // stale MCP session: open a new one once
                continue;
            }
            if (!res.ok) throw new PortalHttpError(res.status, body.slice(0, 200));
            const reply = parseRpcBody(res.headers.get('content-type') ?? '', body, id);
            if (reply.error) throw new Error(`read_memory failed: ${reply.error.message}`);
            const result = reply.result ?? {};
            const text = (result.content ?? [])
                .filter((block) => block.type === 'text')
                .map((block) => block.text ?? '')
                .join('\n');
            if (result.isError) throw new Error(`read_memory failed: ${text.slice(0, 200)}`);
            if (typeof result.structuredContent?.answer === 'string') return result.structuredContent.answer.trim();
            try {
                const parsed = JSON.parse(text) as { answer?: unknown };
                if (typeof parsed?.answer === 'string') return parsed.answer.trim();
            } catch {
                // Plain-text MCP result.
            }
            return text.trim();
        }
        throw new Error('read_memory failed: MCP session could not be re-established');
    }

    async function writeMemory(cfg: ConfigSnapshot, key: string, message: string): Promise<unknown> {
        const res = await send(normalizeBaseUrl(cfg.portalURL), key, writeRequest(message), cfg.writeTimeoutMs);
        const text = await res.text();
        let body: { msg?: string; data?: unknown } | undefined;
        try {
            body = JSON.parse(text) as { msg?: string; data?: unknown };
        } catch {
            body = undefined;
        }
        if (!res.ok) throw new PortalHttpError(res.status, body?.msg ?? text.slice(0, 200));
        return body?.data;
    }

    return {
        readMemory,
        writeMemory,
        reset: () => sessions.clear(),
    };
}
