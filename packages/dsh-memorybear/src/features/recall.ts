/**
 * Profile, per-turn recall and preference injection: an `agent/pre-step`
 * waterfall listener that appends plugin-sourced user messages before the
 * first model call of a turn.
 *
 * @module dsh-memorybear/features/recall
 */
import { NAME, PREFERENCE_SECTION, PROFILE_SECTION } from '../constants.js';
import { missingConfig, type ConfigSnapshot } from '../config.js';
import {
    errorText,
    hasProfileMessage,
    isHumanMessage,
    isSubagentSession,
    messageText,
    pluginUserMessage,
    type Message,
    type PluginContext,
} from '@redbear/dsh-memory-core';
import { recentContext } from '../dsh/session.js';
import type { MemoryBearClient, PreferenceContextMessage } from '../services/memorybear-client.js';
import { renderPreferences, renderProfileMessage, renderRecallMessage } from '../services/render.js';

export interface RecallDeps {
    ctx: PluginContext;
    getConfig(): ConfigSnapshot;
    client: MemoryBearClient;
    /** Whether `memory_search` is currently registered (mentioned in the profile message). */
    isToolRegistered(): boolean;
}

/** Register the `agent/pre-step` listener. */
export function installRecall({ ctx, getConfig, client, isToolRegistered }: RecallDeps): void {
    ctx.on('agent/pre-step', async ({ agent, step, signal }, next) => {
        const decision = await next();
        const cfg = getConfig();
        if (!cfg.profile && !cfg.recall && cfg.preferenceMode !== 'auto') return decision;
        if (missingConfig(cfg).length > 0) return decision;
        if (decision.kind === 'reject' || signal.aborted || step !== 1) return decision;
        if (isSubagentSession(agent.session)) return decision;
        const query = decision.messages.filter(isHumanMessage).map(messageText).join('\n').trim();
        const added: Message[] = [];

        // Preference recall runs alongside profile + memory recall.
        const preferenceTask: Promise<Message | null> | null = cfg.preferenceMode === 'auto' && query.length >= cfg.minQueryChars
            ? (async () => {
                let context: PreferenceContextMessage[] = [];
                try {
                    context = recentContext(agent.session, cfg.preferenceContextMessages);
                } catch (error) {
                    ctx.logger.warn(`[${NAME}] preference context scan failed: ${errorText(error)}`);
                }
                const items = await client.preferences(query, context, signal);
                return items.length > 0
                    ? pluginUserMessage(NAME, renderPreferences(items, cfg.maxRecallChars), PREFERENCE_SECTION)
                    : null;
            })().catch((error: unknown) => {
                if (!signal.aborted) ctx.logger.warn(`[${NAME}] preference recall failed: ${errorText(error)}`);
                return null;
            })
            : null;

        // Session-start profile (`meta`), once per session.
        let profileDue = false;
        if (cfg.profile) {
            try {
                profileDue = !hasProfileMessage(agent.session, NAME, PROFILE_SECTION);
            } catch (error) {
                ctx.logger.warn(`[${NAME}] profile history scan failed: ${errorText(error)}`);
            }
        }
        if (profileDue) {
            try {
                const profile = await client.profile(query || 'user profile', signal);
                if (profile) {
                    const toolOn = cfg.tool && isToolRegistered();
                    added.push(pluginUserMessage(NAME, renderProfileMessage(profile, cfg.maxRecallChars, toolOn), PROFILE_SECTION));
                }
            } catch (error) {
                if (signal.aborted) return decision;
                ctx.logger.warn(`[${NAME}] profile load failed: ${errorText(error)}`);
            }
        }

        // Per-turn recall keyed on the user's words.
        if (cfg.recall && query.length >= cfg.minQueryChars) {
            try {
                const answer = await client.read(query, signal);
                if (answer) added.push(pluginUserMessage(NAME, renderRecallMessage(answer, cfg.maxRecallChars)));
            } catch (error) {
                if (signal.aborted) return decision;
                ctx.logger.warn(`[${NAME}] recall failed: ${errorText(error)}`);
            }
        }

        if (preferenceTask) {
            const message = await preferenceTask;
            if (signal.aborted) return decision;
            if (message) added.push(message);
        }

        return added.length > 0 ? { ...decision, messages: [...decision.messages, ...added] } : decision;
    });
}
