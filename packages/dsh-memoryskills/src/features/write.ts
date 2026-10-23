/**
 * Conversation write-back: `session/event` collection and the `writeMode`
 * batching (per turn / every N turns / on idle).
 *
 * @module dsh-memoryskills/features/write
 */
import { NAME } from '../constants.js';
import type { ConfigSnapshot } from '../config.js';
import {
    errorText,
    isHumanMessage,
    isSubagentSession,
    messageText,
    type Message,
    type PluginContext,
    type Session,
    type SessionEvent,
} from '@redbear/dsh-memory-core';
import { renderTranscripts, type CompletedTurn } from '../services/transcript.js';
import type { PortalClient } from '../services/portal-client.js';

export interface WriteDeps {
    ctx: PluginContext;
    getConfig(): ConfigSnapshot;
    client: PortalClient;
    resolveKey(cfg: ConfigSnapshot): Promise<string | undefined>;
}

/** Controller returned to the plugin entry for settings changes and disposal. */
export interface WriteController {
    flushAll(reason: string): void;
    onSettingsChange(): void;
}

interface TurnState {
    user: string[];
    assistant: string;
    startedAt: number;
}

interface PendingBatch {
    turns: CompletedTurn[];
    timer?: ReturnType<typeof setTimeout>;
}

/** Events this feature reads from the durable session log. */
interface TurnEventData {
    reason?: { kind?: string };
    message?: Message;
}

function eventData(event: SessionEvent): TurnEventData {
    return (event.data ?? {}) as TurnEventData;
}

/** Register the write listener and the disposal flush. */
export function installWrite({ ctx, getConfig, client, resolveKey }: WriteDeps): WriteController {
    /** sessionId -> turn in progress. */
    const turns = new Map<string, TurnState>();
    /** sessionId -> completed turns not yet written. */
    const pending = new Map<string, PendingBatch>();
    /** Writes go out one at a time so the per-key rate limit is not hit by a burst. */
    let writeChain: Promise<void> = Promise.resolve();

    function sessionKey(session: Session): string {
        return String(session.id);
    }

    function flush(id: string, reason: string): void {
        const batch = pending.get(id);
        if (!batch) return;
        clearTimeout(batch.timer);
        pending.delete(id);
        if (batch.turns.length === 0) return;
        const cfg = getConfig();
        const messages = renderTranscripts(batch.turns, cfg);
        writeChain = writeChain.then(async () => {
            const key = await resolveKey(cfg);
            if (!key) throw new Error(`no API key under ${cfg.apiKeyEnv}`);
            for (const [index, message] of messages.entries()) {
                await client.writeMemory(cfg, key, message);
                ctx.logger.info(`[${NAME}] write ${index + 1}/${messages.length} (${reason}, ${batch.turns.length} turn(s)) queued for session ${id}`);
            }
        }).catch((error: unknown) => {
            const status = error instanceof Error && 'status' in error ? Number((error as { status?: unknown }).status) : undefined;
            const hint = status === 429 ? ' (rate limited; not retried)'
                : status === 402 ? ' (write quota used up)'
                    : status === 401 ? ' (key invalid or disabled)' : '';
            ctx.logger.warn(`[${NAME}] write (${reason}) failed for session ${id}${hint}: ${errorText(error)}`);
        });
    }

    function flushAll(reason: string): void {
        for (const id of [...pending.keys()]) flush(id, reason);
    }

    function armIdle(id: string, cfg: ConfigSnapshot): void {
        const batch = pending.get(id);
        if (!batch) return;
        clearTimeout(batch.timer);
        batch.timer = setTimeout(() => flush(id, 'idle'), cfg.writeIdleMinutes * 60_000);
        batch.timer.unref?.();
    }

    ctx.on('session/event', (session, event) => {
        if (isSubagentSession(session)) return;
        const cfg = getConfig();
        if (!cfg.write || !cfg.portalURL.trim()) return;
        const id = sessionKey(session);
        switch (event.type) {
            case 'turn/start': {
                turns.set(id, { user: [], assistant: '', startedAt: event.time ?? Date.now() });
                const batch = pending.get(id);
                if (batch) clearTimeout(batch.timer);
                return;
            }
            case 'user/message': {
                const state = turns.get(id);
                const message = event.data as Message | undefined;
                const text = isHumanMessage(message) ? messageText(message) : '';
                if (state && text) state.user.push(text);
                return;
            }
            case 'assistant/message': {
                const state = turns.get(id);
                const text = messageText(eventData(event).message);
                if (state && text) state.assistant = text; // keep the final answer
                return;
            }
            case 'turn/end': {
                const state = turns.get(id);
                turns.delete(id);
                if (state && eventData(event).reason?.kind === 'completed' && state.user.length > 0 && state.assistant) {
                    const batch = pending.get(id) ?? { turns: [] };
                    batch.turns.push({ at: new Date(state.startedAt).toISOString(), user: state.user, assistant: state.assistant });
                    pending.set(id, batch);
                }
                const batch = pending.get(id);
                if (!batch) return;
                if (cfg.writeMode === 'turn') flush(id, 'turn');
                else if (cfg.writeMode === 'batch' && batch.turns.length >= cfg.writeEveryTurns) flush(id, 'batch');
                else armIdle(id, cfg);
                return;
            }
            default:
        }
    });

    ctx.on('session/disposed', (session) => {
        const id = sessionKey(session);
        turns.delete(id);
        flush(id, 'session-disposed');
    });
    ctx.effect(() => () => flushAll('dispose'), `${NAME}: flush pending writes`);

    return {
        flushAll,
        onSettingsChange() {
            const cfg = getConfig();
            if (!cfg.write || cfg.writeMode === 'turn') flushAll('mode-change');
            else for (const id of pending.keys()) armIdle(id, cfg);
        },
    };
}
