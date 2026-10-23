/**
 * Host-facing message helpers shared by the memory plugins.
 *
 * @module dsh-memory-core/dsh/messages
 */
import { randomUUID } from 'node:crypto';
import type {
    AttachmentBlock,
    AttachmentMode,
    Message,
    Session,
    SessionEvent,
} from './types.js';

/** Join the text blocks of one dsh message. */
export function messageText(message: Message | undefined): string {
    return (message?.content ?? [])
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n')
        .trim();
}

/** Whether the message was typed by the human (not a plugin/system injection). */
export function isHumanMessage(message: Message | undefined): boolean {
    return message?.role === 'user' && message.source?.kind === 'user';
}

/** Recursively freeze a plain object, mirroring dsh-llm `freezeMessage`. */
function deepFreeze<T>(value: T): T {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    }
    return value;
}

/**
 * Build a plugin-sourced user message shaped like dsh-llm's
 * `createUserMessage` output (fresh UUID id, frozen).
 */
export function pluginUserMessage(kind: string, text: string, section: string = kind): Message {
    return deepFreeze({
        id: randomUUID(),
        role: 'user',
        content: [{ type: 'text', text }],
        // dsh >= 0.2 (session format v4): the producer's own name is the kind;
        // the retired `{ kind: 'plugin', plugin }` wrapper is refused.
        source: { kind, form: 'snapshot', sections: [{ name: section, text }] },
    });
}

/**
 * Whether a message source was produced by this plugin, in any shape:
 * v4 native (`kind: name`), v3 rows migrated by dsh (`kind: 'plugin:<name>'`),
 * or the 0.1.x wrapper (`kind: 'plugin', plugin: name`).
 */
function isOwnSource(source: Message['source'], kind: string): boolean {
    return source?.kind === kind || source?.kind === `plugin:${kind}`
        || (source?.kind === 'plugin' && source.plugin === kind);
}

/**
 * Whether this session already carries an injected profile message. Scans the
 * durable event log, so a resumed session is not re-loaded.
 */
export function hasProfileMessage(session: Session | undefined, kind: string, profileSection: string): boolean {
    for (let seq = (session?.seq ?? 0) - 1; seq >= 0; seq -= 1) {
        const event = session?.eventAt(seq) as SessionEvent | undefined;
        if (event?.type !== 'user/message') continue;
        const source = (event.data as Message | undefined)?.source;
        if (isOwnSource(source, kind) && source?.sections?.some((section) => section.name === profileSection)) return true;
    }
    return false;
}

/**
 * The attachment blocks of one user message that `mode` allows writing.
 * dsh carries them as `{type:'image', attachment}` and
 * `{type:'file', attachment}` content blocks.
 */
export function messageAttachments(message: Message | undefined, mode: AttachmentMode): AttachmentBlock[] {
    if (mode === 'none') return [];
    return (message?.content ?? []).filter((block): block is AttachmentBlock => {
        if (block.type !== 'image' && block.type !== 'file') return false;
        if (typeof (block as AttachmentBlock).attachment !== 'object') return false;
        return block.type === 'image' || mode === 'all';
    });
}

/**
 * Text stand-in for a user message that carries attachments but no text;
 * `/memory/write` requires non-empty `content`.
 */
export function attachmentPlaceholder(blocks: readonly AttachmentBlock[], language: string): string {
    const zh = language !== 'en';
    return blocks.map((block) => {
        const label = block.type === 'image' ? (zh ? '图片' : 'image') : (zh ? '文件' : 'file');
        return block.attachment.name ? `[${label}: ${block.attachment.name}]` : `[${label}]`;
    }).join(' ');
}

/** Clip text to `max` characters, marking the cut with an ellipsis. */
export function clip(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max)}…` : text;
}
