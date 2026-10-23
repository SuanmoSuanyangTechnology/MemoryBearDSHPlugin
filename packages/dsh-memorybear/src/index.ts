/**
 * MemoryBear long-term memory for DeepSeek Harness.
 *
 * Three integration points:
 *
 * 1. Recall — `agent/pre-step` reads the new user text, calls
 *    `POST /memory/read/sync`, and appends plugin-sourced user messages.
 * 2. Write — `session/event` collects the turn's human text and final
 *    assistant text and posts them to `POST /memory/write`; attachments are
 *    uploaded with `POST /memory/files/upload`.
 * 3. Tools — `memory_search` (and optionally `memory_preferences`) through the
 *    host `tools` service, which is an OPTIONAL dependency.
 *
 * Memory is keyed by ONE fixed `endUserId` (one dsh user = one MemoryBear end
 * user). Subagent sessions are skipped for recall and write.
 *
 * @module @redbear/dsh-memorybear
 */
import { INJECT, NAME } from './constants.js';
import { missingConfig, snapshotConfig, type PluginConfig } from './config.js';
import { errorText, resolveCredential, type PluginContext } from '@redbear/dsh-memory-core';
import { installPanel } from './features/panel.js';
import { installRecall } from './features/recall.js';
import { installTools } from './features/tools.js';
import { installWrite } from './features/write.js';
import { createMemoryBearClient } from './services/memorybear-client.js';

export { Config } from './config.js';
export {
    ATTACHMENT_MODES,
    INSIGHTS_PATH,
    NAME,
    PREFERENCE_MODES,
    SETTINGS_NAMESPACE,
    TOOL_SEARCH_SWITCHES,
    WRITE_MODES,
} from './constants.js';

/** Cordis plugin name; also the `source.kind` of injected messages. */
export const name = NAME;

/** Required services; `tools` and `connection` are optional and picked up via `ctx.inject`. */
export const inject = [...INJECT];

/** Install recall, write and the memory_search tool. */
export function apply(ctx: PluginContext, config: PluginConfig): void {
    if (!config.enabled) {
        ctx.logger.info(`[${NAME}] disabled`);
        return;
    }

    // Runtime config (dsh >= 0.2): every field but `enabled` is a volatile
    // reference. The Plugins page saves edits into the profile patch and the
    // Loader commits them into these references in place, so reading them per
    // operation picks up edits without a remount.
    const current = () => snapshotConfig(config);
    const resolveKey = (cfg: ReturnType<typeof current>) => resolveCredential(ctx, cfg.apiKeyEnv, NAME);
    const client = createMemoryBearClient(current, resolveKey);

    const startup = current();
    const startupMissing = missingConfig(startup);
    if (startupMissing.length > 0) {
        ctx.logger.warn(`[${NAME}] not configured (missing ${startupMissing.join(', ')}); memory recall/write are off until set on the Plugins page or in the profile patch`);
    }
    resolveKey(startup).then((key) => {
        if (!key && startupMissing.length === 0) ctx.logger.warn(`[${NAME}] no API key under ${startup.apiKeyEnv}; MemoryBear calls will be rejected`);
    }, (error: unknown) => {
        ctx.logger.warn(`[${NAME}] credential lookup failed: ${errorText(error)}`);
    });

    const write = installWrite({ ctx, getConfig: current, client });
    const tools = installTools({ ctx, getConfig: current, client });
    installRecall({ ctx, getConfig: current, client, isToolRegistered: tools.isSearchRegistered });

    // A Plugins-page save of volatile fields lands here, after the Loader has
    // committed the new values into the references `current()` reads.
    ctx.on('loader/volatile-update', () => {
        write.onSettingsChange();
        tools.sync();
    });

    installPanel({ ctx, getConfig: current, client });

    ctx.logger.info(`[${NAME}] loaded; endUser=${startup.endUserId}; profile=${startup.profile} recall=${startup.recall} preferences=${startup.preferenceMode} write=${startup.write}/${startup.writeMode} tool=${startup.tool}`);
}

export type { AttachmentMode, PreferenceMode, WriteMode } from './constants.js';
export type { ConfigSnapshot, PluginConfig } from './config.js';
export type { CommunityCard, MemorySummary } from './services/payloads.js';
export type { Preference } from './services/render.js';
