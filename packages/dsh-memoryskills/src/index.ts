/**
 * MemorySkills long-term memory for DeepSeek Harness.
 *
 * MemorySkills (MemoryLiteSkills) is the end-user front door of MemoryBear:
 * a user signs in on its Portal with an email code and gets a personal
 * `sk-mem-` key. The Portal holds the workspace key and injects the user's
 * `end_user_id` itself, so this plugin needs only the Portal URL and that key.
 *
 * Integration points (same seams as dsh-memorybear):
 *
 * 1. Profile + recall — `agent/pre-step` appends plugin-sourced user messages.
 * 2. Write — `session/event` collects completed turns and sends them to the
 *    Portal's REST write endpoint according to `writeMode`.
 * 3. Tool — `memory_search`, backed by the Portal's MCP `read_memory`.
 *
 * @module @redbearai/dsh-memoryskills
 */
import { INJECT, NAME } from './constants.js';
import { snapshotConfig, type PluginConfig } from './config.js';
import { errorText, resolveCredential, type PluginContext } from '@redbearai/dsh-memory-core';
import { installRecall } from './features/recall.js';
import { installTools } from './features/tools.js';
import { installUpdateCheck } from './features/update.js';
import { installWrite } from './features/write.js';
import { normalizeBaseUrl } from './services/api.js';
import { createPortalClient } from './services/portal-client.js';

export { Config } from './config.js';
export { DEFAULT_PORTAL, NAME, TOOL_SEARCH_SWITCHES, UPDATE_PATH, WRITE_MODES } from './constants.js';

/** Cordis plugin name; also the `source.kind` of injected messages. */
export const name = NAME;

/** Required services; `tools` is optional and picked up via `ctx.inject`. */
export const inject = [...INJECT];

/** Install profile/recall, write and the memory_search tool. */
export function apply(ctx: PluginContext, config: PluginConfig): void {
    if (!config.enabled) {
        ctx.logger.info(`[${NAME}] disabled`);
        return;
    }
    const current = () => snapshotConfig(config);
    const resolveKey = (cfg: ReturnType<typeof current>) => resolveCredential(ctx, cfg.apiKeyEnv, NAME);
    const client = createPortalClient(current, resolveKey);
    const configured = (cfg: ReturnType<typeof current>) => Boolean(normalizeBaseUrl(cfg.portalURL));

    const startup = current();
    resolveKey(startup).then((key) => {
        if (!key) ctx.logger.warn(`[${NAME}] no API key under ${startup.apiKeyEnv}; sign in at ${normalizeBaseUrl(startup.portalURL)}/#/login to get one`);
        else if (!key.startsWith('sk-mem-')) ctx.logger.warn(`[${NAME}] key under ${startup.apiKeyEnv} is not an sk-mem- MemorySkills key`);
    }, (error: unknown) => {
        ctx.logger.warn(`[${NAME}] credential lookup failed: ${errorText(error)}`);
    });

    const write = installWrite({ ctx, getConfig: current, client, resolveKey });
    const tools = installTools({ ctx, getConfig: current, client });
    installRecall({ ctx, getConfig: current, client, isToolRegistered: tools.isSearchRegistered });
    const update = installUpdateCheck({ ctx, getConfig: current });

    ctx.on('loader/volatile-update', () => {
        client.reset();
        write.onSettingsChange();
        tools.sync();
        update.check();
    });

    if (!configured(startup)) {
        ctx.logger.warn(`[${NAME}] no Portal URL configured; memory recall/write are off until set on the Plugins page`);
    }
    ctx.logger.info(`[${NAME}] loaded; portal=${normalizeBaseUrl(startup.portalURL)} profile=${startup.profile} recall=${startup.recall} write=${startup.write}/${startup.writeMode} tool=${startup.tool}`);
}

export type { ConfigSnapshot, PluginConfig } from './config.js';
export type { CompletedTurn } from './services/transcript.js';
