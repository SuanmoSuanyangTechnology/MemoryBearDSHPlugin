/**
 * Reads prior turns from the durable session event log.
 *
 * @module dsh-memorybear/dsh/session
 */
import { PREFERENCE_CONTEXT_MAX_CHARS } from '../constants.js';
import { isHumanMessage, messageText } from '@redbear/dsh-memory-core';
import type { PreferenceContextMessage } from '../services/memorybear-client.js';
import type { Message, Session } from '@redbear/dsh-memory-core';

/**
 * The last completed exchanges before the current turn, oldest first, for
 * preference routing. Everything after the latest `turn/start` belongs to the
 * current turn and is skipped; per earlier turn the human messages and the
 * final assistant text are kept.
 */
export function recentContext(session: Session | undefined, max: number): PreferenceContextMessage[] {
    const out: PreferenceContextMessage[] = [];
    if (!max || typeof session?.eventAt !== 'function') return out;
    let inCurrent = true;
    let assistantSeen = false;
    for (let seq = (session.seq ?? 0) - 1; seq >= 0 && out.length < max; seq -= 1) {
        const event = session.eventAt(seq);
        if (event?.type === 'turn/start') {
            inCurrent = false;
            assistantSeen = false;
            continue;
        }
        if (inCurrent) continue;
        if (event?.type === 'assistant/message' && !assistantSeen) {
            const data = event.data as { message?: Message } | undefined;
            const text = messageText(data?.message);
            if (text) {
                assistantSeen = true;
                out.push({ role: 'assistant', content: text.slice(0, PREFERENCE_CONTEXT_MAX_CHARS) });
            }
        } else if (event?.type === 'user/message' && isHumanMessage(event.data as Message | undefined)) {
            const text = messageText(event.data as Message);
            if (text) out.push({ role: 'user', content: text.slice(0, PREFERENCE_CONTEXT_MAX_CHARS) });
        }
    }
    return out.reverse();
}
