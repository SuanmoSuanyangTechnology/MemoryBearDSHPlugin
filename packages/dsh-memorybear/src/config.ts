/**
 * Plugin configuration schema and the snapshot helpers used to read volatile
 * fields (dsh >= 0.2 exposes every field but `enabled` as a `{ get() }` ref).
 *
 * @module dsh-memorybear/config
 */
import z from '@deepseek-ai/schemastery';
import { ATTACHMENT_MODES, PREFERENCE_MODES, TOOL_SEARCH_SWITCHES, WRITE_MODES } from './constants.js';

/** Plugin configuration (validated by dsh's Loader). */
export const Config = z.object({
    enabled: z.boolean().default(true),
    /** Check npm for a newer release and show a notice; never auto-installs. */
    updateCheck: z.boolean().default(true).volatile(),
    /** V1 service API root, e.g. `https://host/v1`. */
    baseURL: z.string().default('').volatile(),
    /**
     * Credential reference for the API key (sent as `Authorization: Bearer`).
     * Resolved through dsh's credential store (launch env, `.credentials.yaml`,
     * `.env`), so the Plugins page can store a key without it touching settings.
     */
    apiKeyEnv: z.string().role('credential-ref').default('MEMORYBEAR_API_KEY').volatile(),
    /** The MemoryBear end_user UUID that owns this dsh user's memory. */
    endUserId: z.string().default('').volatile(),
    /** deep | normal | quick | express | recent | meta (server enum aliases). */
    searchSwitch: z.string().default('express').volatile(),
    /** Per-turn automatic recall with `searchSwitch` (noisy for unrelated questions). */
    recall: z.boolean().default(true).volatile(),
    /**
     * How the preference engine (`/memory/preference/recall`) is used:
     * - `auto`: recall the preferences for this turn's task at the start of each turn;
     * - `tool`: register `memory_preferences` and let the model query when it needs to;
     * - `off`: neither.
     */
    preferenceMode: z.union(PREFERENCE_MODES.map((mode) => z.const(mode))).default('auto').volatile(),
    /** Earlier messages sent with the preference request as routing context (the server also caps it). */
    preferenceContextMessages: z.number().step(1).min(0).default(4).volatile(),
    /** Budget for one preference recall; it runs alongside memory recall. */
    preferenceTimeoutMs: z.number().step(1).min(1).default(8_000).volatile(),
    /** Load the MemoryBear `meta` user profile once, on a session's first turn. */
    profile: z.boolean().default(false).volatile(),
    write: z.boolean().default(true).volatile(),
    /**
     * When completed turns are sent to `/memory/write`:
     * - `turn`: after every completed turn;
     * - `batch`: every `writeEveryTurns` turns, plus a flush after `writeIdleMinutes` idle;
     * - `idle`: once the session has been idle for `writeIdleMinutes`.
     */
    writeMode: z.union(WRITE_MODES.map((mode) => z.const(mode))).default('turn').volatile(),
    writeEveryTurns: z.number().step(1).min(1).default(3).volatile(),
    writeIdleMinutes: z.number().min(0.1).default(10).volatile(),
    tool: z.boolean().default(true).volatile(),
    /** Recall budget per turn; a slow MemoryBear must not stall the agent. */
    recallTimeoutMs: z.number().step(1).min(1).default(8_000).volatile(),
    /** Budget for one memory_search call; the model may pick a slower mode. */
    toolTimeoutMs: z.number().step(1).min(1).default(30_000).volatile(),
    /** Modes memory_search offers the model (subset of TOOL_SEARCH_SWITCHES). */
    toolSearchSwitches: z.array(z.string()).default([...TOOL_SEARCH_SWITCHES]).volatile(),
    /** Budget for normal/deep in memory_search; on timeout it falls back to `quick`. */
    slowSearchTimeoutMs: z.number().step(1).min(1).default(15_000).volatile(),
    writeTimeoutMs: z.number().step(1).min(1).default(15_000).volatile(),
    /** Cap on injected memory text. */
    maxRecallChars: z.number().step(1).min(1).default(4_000).volatile(),
    /** Skip recall for user text shorter than this (e.g. "ok", "继续"). */
    minQueryChars: z.number().step(1).min(0).default(2).volatile(),
    /** Sent as `X-Language-Type` on writes: zh | en. */
    language: z.string().default('zh').volatile(),
    /**
     * Attachments written with the user's messages:
     * - `none`: text only;
     * - `images`: dsh image attachments (PNG/JPEG/WebP/GIF);
     * - `all`: images plus files MemoryBear can parse (documents, audio, video).
     */
    attachments: z.union(ATTACHMENT_MODES.map((mode) => z.const(mode))).default('images').volatile(),
    /** Attachments larger than this are skipped (MemoryBear's default upload cap is 50 MB). */
    maxAttachmentMB: z.number().min(0.1).default(20).volatile(),
    /** Budget for one `/memory/files/upload` call. */
    uploadTimeoutMs: z.number().step(1).min(1).default(60_000).volatile(),
    /** Show the 记忆 (memory) tab in dsh web's right sidebar. */
    panel: z.boolean().default(true).volatile(),
    /** Budget for each MemoryBear call behind the memory panel. */
    panelTimeoutMs: z.number().step(1).min(1).default(20_000).volatile(),
});

/** The parsed config as handed to `apply` (volatile fields are references). */
export type PluginConfig = ReturnType<typeof Config>;

/** A volatile config reference. */
export interface ConfigRef<T> {
    get(): T;
}

type Unwrap<T> = T extends ConfigRef<infer V> ? V : T;

/** Plain values for one operation. */
export type ConfigSnapshot = { -readonly [K in keyof PluginConfig]: Unwrap<PluginConfig[K]> };

/** Snapshot type for an arbitrary config-shaped object. */
export type SnapshotOf<T extends object> = { -readonly [K in keyof T]: Unwrap<T[K]> };

/** Names of the required connection fields. */
export const CONNECTION_FIELDS = ['baseURL', 'endUserId'] as const;

function isConfigRef(value: unknown): value is ConfigRef<unknown> {
    return value !== null && typeof value === 'object' && typeof (value as { get?: unknown }).get === 'function';
}

/** Read every volatile field of a config into plain values for one operation. */
export function snapshotConfig<T extends object>(config: T): SnapshotOf<T> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
        out[key] = isConfigRef(value) ? value.get() : value;
    }
    return out as SnapshotOf<T>;
}

/** Names of the required connection fields that are still empty. */
export function missingConfig(cfg: ConfigSnapshot): string[] {
    return CONNECTION_FIELDS.filter((key) => !String(cfg[key] ?? '').trim());
}

/** Whether `zone` is an IANA time zone this runtime knows. */
export function isTimeZone(zone: string): boolean {
    if (!zone || zone.length > 64) return false;
    try {
        new Intl.DateTimeFormat('en', { timeZone: zone });
        return true;
    } catch {
        return false;
    }
}
