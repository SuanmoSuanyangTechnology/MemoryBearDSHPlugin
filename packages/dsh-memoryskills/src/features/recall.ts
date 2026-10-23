/**
 * Profile and per-turn recall: an `agent/pre-step` waterfall listener that
 * appends plugin-sourced user messages before the first model call of a turn.
 *
 * @module dsh-memoryskills/features/recall
 */
import { NAME, PROFILE_SECTION } from '../constants.js';
import type { ConfigSnapshot } from '../config.js';
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
import { profileText } from '../services/transcript.js';
import { renderProfileMessage, renderRecallMessage } from '../services/render.js';
import { normalizeBaseUrl } from '../services/api.js';
import type { PortalClient } from '../services/portal-client.js';

export interface RecallDeps {
    ctx: PluginContext;
    getConfig(): ConfigSnapshot;
    client: PortalClient;
    /** Whether `memory_search` is currently registered (mentioned in the profile message). */
    isToolRegistered(): boolean;
}

/** Register the `agent/pre-step` listener. */
export function installRecall({ ctx, getConfig, client, isToolRegistered }: RecallDeps): void {
    ctx.on('agent/pre-step', async ({ agent, step, signal }, next) => {
        const decision = await next();
        const cfg = getConfig();
        if (!cfg.profile && !cfg.recall) return decision;
        if (!normalizeBaseUrl(cfg.portalURL)) return decision;
        if (decision.kind === 'reject' || signal.aborted || step !== 1) return decision;
        if (isSubagentSession(agent.session)) return decision;
        const query = decision.messages.filter(isHumanMessage).map(messageText).join('\n').trim();
        const added: Message[] = [];

        let profileDue = false;
        if (cfg.profile) {
            try {
                profileDue = !hasProfileMessage(agent.session, NAME, PROFILE_SECTION);
            } catch (error) {
                ctx.logger.warn(`[${NAME}] profile history scan failed: ${errorText(error)}`);
            }
        }

        const profileTask = profileDue
            ? client.readMemory(query || 'user profile', signal, { searchSwitch: 'meta' }).then((answer) => {
                const profile = profileText(answer);
                return profile
                    ? pluginUserMessage(NAME, renderProfileMessage(profile, cfg.maxRecallChars, cfg.tool && isToolRegistered()), PROFILE_SECTION)
                    : null;
            })
            : null;
        const recallTask = cfg.recall && query.length >= cfg.minQueryChars
            ? client.readMemory(query, signal).then((answer) => (answer ? pluginUserMessage(NAME, renderRecallMessage(answer, cfg.maxRecallChars)) : null))
            : null;
        const tasks = [profileTask, recallTask];
        const labels = ['profile load', 'recall'];
        const results = await Promise.allSettled(tasks.map((task) => task ?? Promise.resolve(null)));
        if (signal.aborted) return decision;
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) added.push(result.value);
            else if (result.status === 'rejected') ctx.logger.warn(`[${NAME}] ${labels[index]} failed: ${errorText(result.reason)}`);
        });
        return added.length > 0 ? { ...decision, messages: [...decision.messages, ...added] } : decision;
    });
}
