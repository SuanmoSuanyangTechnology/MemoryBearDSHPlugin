/**
 * Plugin configuration schema and the snapshot helpers used to read volatile
 * fields (dsh >= 0.2 exposes every field but `enabled` as a `{ get() }` ref).
 *
 * @module dsh-memoryskills/config
 */
import z from '@deepseek-ai/schemastery';
import { DEFAULT_PORTAL, TOOL_SEARCH_SWITCHES, WRITE_MODES } from './constants.js';

/** Plugin configuration (validated by dsh's Loader). */
export const Config = z.object({
    enabled: z.boolean().default(true),
    /** MemorySkills Portal root, e.g. `https://memoryskills.redbearai.com`. */
    portalURL: z.string().default(DEFAULT_PORTAL).volatile(),
    /**
     * Credential reference for the user's `sk-mem-` key (sent as
     * `Authorization: Bearer`). Resolved through dsh's credential store
     * (launch env, `.credentials.yaml`, `.env`), then the process env.
     */
    apiKeyEnv: z.string().role('credential-ref').default('MEMORYSKILLS_API_KEY').volatile(),
    /** Load the `meta` profile once, on a session's first turn. */
    profile: z.boolean().default(true).volatile(),
    /** Per-turn automatic recall with `searchSwitch` (off: the model calls memory_search). */
    recall: z.boolean().default(false).volatile(),
    /** Mode for automatic recall and memory_search's default: express | quick | normal | deep. */
    searchSwitch: z.string().default('express').volatile(),
    write: z.boolean().default(true).volatile(),
    /**
     * When completed turns are written:
     * - `turn`: after every completed turn (one quota unit per turn);
     * - `batch`: every `writeEveryTurns` turns, plus a flush after `writeIdleMinutes` idle;
     * - `idle`: once the session has been idle for `writeIdleMinutes`.
     * Pending turns are also flushed when the session or the plugin is disposed.
     */
    writeMode: z.union(WRITE_MODES.map((mode) => z.const(mode))).default('batch').volatile(),
    writeEveryTurns: z.number().step(1).min(1).default(3).volatile(),
    writeIdleMinutes: z.number().min(0.1).default(10).volatile(),
    /** Cap on one turn's assistant text in the written transcript. */
    maxAssistantChars: z.number().step(1).min(1).default(2_000).volatile(),
    /** Transcript labels: zh (用户/助手) | en (User/Assistant). */
    language: z.string().default('zh').volatile(),
    tool: z.boolean().default(true).volatile(),
    /** Modes memory_search offers the model (subset of TOOL_SEARCH_SWITCHES). */
    toolSearchSwitches: z.array(z.string()).default([...TOOL_SEARCH_SWITCHES]).volatile(),
    /** Budget for profile load and automatic recall; a slow Portal must not stall the agent. */
    recallTimeoutMs: z.number().step(1).min(1).default(8_000).volatile(),
    /** Budget for one memory_search call in a fast mode. */
    toolTimeoutMs: z.number().step(1).min(1).default(30_000).volatile(),
    /** Budget for normal/deep in memory_search; on timeout it falls back to `quick`. */
    slowSearchTimeoutMs: z.number().step(1).min(1).default(60_000).volatile(),
    writeTimeoutMs: z.number().step(1).min(1).default(15_000).volatile(),
    /** Cap on injected memory text. */
    maxRecallChars: z.number().step(1).min(1).default(4_000).volatile(),
    /** Skip recall for user text shorter than this (e.g. "ok", "继续"). */
    minQueryChars: z.number().step(1).min(0).default(2).volatile(),
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

function isConfigRef(value: unknown): value is ConfigRef<unknown> {
    return value !== null && typeof value === 'object' && typeof (value as { get?: unknown }).get === 'function';
}

/**
 * Read every volatile field of a config into plain values for one operation.
 * The Loader commits settings edits into the references in place, so reading
 * them per operation picks those edits up without a restart.
 */
export function snapshotConfig<T extends object>(config: T): SnapshotOf<T> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
        out[key] = isConfigRef(value) ? value.get() : value;
    }
    return out as SnapshotOf<T>;
}
