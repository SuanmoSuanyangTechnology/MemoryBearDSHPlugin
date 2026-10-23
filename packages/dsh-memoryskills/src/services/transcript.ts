/**
 * Rendering of completed turns into Portal write messages.
 *
 * @module dsh-memoryskills/services/transcript
 */
import { WRITE_MAX_CHARS } from '../constants.js';
import { clip } from '@redbear/dsh-memory-core';

/** One completed turn collected from the session event log. */
export interface CompletedTurn {
    /** ISO timestamp of the turn start. */
    at: string;
    /** Text of each human message in the turn. */
    user: string[];
    /** Final assistant text of the turn. */
    assistant: string;
}

/** Settings that affect the rendered transcript. */
export interface TranscriptOptions {
    language?: string;
    maxAssistantChars: number;
}

/** Profile text from a `meta` answer: the `<user-info>` wrapper is dropped. */
export function profileText(answer: string): string {
    return String(answer ?? '').replace(/<\/?user-info>/g, '').trim();
}

/**
 * Render completed turns as write messages of at most `maxChars` each.
 * One turn = a header with its time plus labelled user/assistant lines; a turn
 * longer than the cap is clipped, turns are packed greedily.
 */
export function renderTranscripts(
    turns: readonly CompletedTurn[],
    options: TranscriptOptions,
    maxChars: number = WRITE_MAX_CHARS,
): string[] {
    const zh = options.language !== 'en';
    const [userLabel, botLabel] = zh ? ['用户', '助手'] : ['User', 'Assistant'];
    const separator = zh ? '：' : ': ';
    const blocks = turns.map(({ at, user, assistant }) => clip([
        `[${zh ? '对话时间' : 'Conversation at'} ${at}]`,
        ...user.map((text) => `${userLabel}${separator}${text}`),
        `${botLabel}${separator}${clip(assistant, options.maxAssistantChars)}`,
    ].join('\n'), maxChars - 1));
    const out: string[] = [];
    for (const block of blocks) {
        const last = out.length > 0 ? out[out.length - 1] : undefined;
        if (last !== undefined && last.length + 2 + block.length <= maxChars) out[out.length - 1] = `${last}\n\n${block}`;
        else out.push(block);
    }
    return out;
}
