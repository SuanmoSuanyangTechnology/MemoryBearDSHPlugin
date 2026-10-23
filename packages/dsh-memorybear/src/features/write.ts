/**
 * Conversation write-back: `session/event` collection, attachment upload and
 * the `writeMode` batching (per turn / every N turns / on idle).
 *
 * @module dsh-memorybear/features/write
 */
import { IMAGE_EXT, NAME, UPLOAD_CACHE_MAX } from '../constants.js';
import { missingConfig, type ConfigSnapshot } from '../config.js';
import {
    attachmentPlaceholder,
    errorText,
    isHumanMessage,
    isSubagentSession,
    messageAttachments,
    messageText,
    type AttachmentBlock,
    type Message,
    type PluginContext,
    type Session,
    type SessionEvent,
} from '@redbear/dsh-memory-core';
import { fileKind } from '../services/payloads.js';
import type { MemoryBearClient, MemoryBearFile, WriteMessage } from '../services/memorybear-client.js';

export interface WriteDeps {
    ctx: PluginContext;
    getConfig(): ConfigSnapshot;
    client: MemoryBearClient;
}

/** Controller returned to the plugin entry for settings changes and disposal. */
export interface WriteController {
    flushAll(reason: string): void;
    onSettingsChange(): void;
}

interface TurnUserMessage {
    content: string;
    attachments: AttachmentBlock[];
}

interface TurnState {
    user: TurnUserMessage[];
    assistant: string;
    startedAt: number;
}

interface PendingBatch {
    messages: WriteMessage[];
    turns: number;
    timer?: ReturnType<typeof setTimeout>;
}

interface TurnEventData {
    reason?: { kind?: string };
    message?: Message;
}

function eventData(event: SessionEvent): TurnEventData {
    return (event.data ?? {}) as TurnEventData;
}

/** Register the write listener and the disposal flush. */
export function installWrite({ ctx, getConfig, client }: WriteDeps): WriteController {
    /** sessionId -> the turn in progress. */
    const turns = new Map<string, TurnState>();
    /** sessionId -> completed turns not yet written. */
    const pending = new Map<string, PendingBatch>();
    /** `baseURL|attachmentId` -> uploaded `file_id`, so an attachment reused across turns is uploaded once. */
    const uploaded = new Map<string, string>();

    /**
     * Turn one message's attachment blocks into MemoryBear `files` entries:
     * read the bytes from the host `attachments` service, upload each, and
     * reference it as `local_file`. A block that cannot be read, is too big,
     * has a type MemoryBear cannot parse, or fails to upload is skipped with
     * a warning; the text of the turn is still written.
     */
    async function resolveFiles(blocks: readonly AttachmentBlock[], cfg: ConfigSnapshot): Promise<MemoryBearFile[]> {
        const store = ctx.get('attachments');
        if (!store) {
            ctx.logger.warn(`[${NAME}] ${blocks.length} attachment(s) not written: no attachments service in this profile`);
            return [];
        }
        const maxBytes = cfg.maxAttachmentMB * 1024 * 1024;
        const files: MemoryBearFile[] = [];
        for (const { type, attachment: ref } of blocks) {
            const isImage = type === 'image';
            // attachmentId is opaque (e.g. `sha256:<hex>`); keep only filename-safe characters.
            const idTag = String(ref.attachmentId).replace(/^[a-z0-9]+:/i, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
            const fileName = ref.name || (isImage
                ? `image-${idTag}.${IMAGE_EXT[ref.mediaType ?? ''] ?? 'png'}`
                : `file-${idTag}`);
            const kind = isImage ? 'image' : fileKind(fileName);
            try {
                if (!kind) throw new Error('type not supported by MemoryBear');
                if (ref.bytes > maxBytes) throw new Error(`${ref.bytes} bytes exceeds maxAttachmentMB=${cfg.maxAttachmentMB}`);
                const cacheKey = `${cfg.baseURL}|${ref.attachmentId}`;
                let fileId = uploaded.get(cacheKey);
                if (!fileId) {
                    let data: Uint8Array;
                    if (isImage) {
                        data = (await store.readImage(ref)).data;
                    } else {
                        const chunks: Uint8Array[] = [];
                        for await (const chunk of store.readFileStream(ref)) chunks.push(chunk);
                        data = Buffer.concat(chunks);
                    }
                    fileId = await client.upload({ data, name: fileName, mediaType: isImage ? ref.mediaType : undefined });
                    uploaded.set(cacheKey, fileId);
                    if (uploaded.size > UPLOAD_CACHE_MAX) {
                        const oldest = uploaded.keys().next().value;
                        if (oldest !== undefined) uploaded.delete(oldest);
                    }
                }
                files.push({
                    type: kind,
                    transfer_method: 'local_file',
                    upload_file_id: fileId,
                    name: fileName,
                    size: ref.bytes,
                    ...(isImage && ref.mediaType ? { file_type: ref.mediaType } : {}),
                });
            } catch (error) {
                ctx.logger.warn(`[${NAME}] attachment ${fileName} not written: ${errorText(error)}`);
            }
        }
        return files;
    }

    /** Upload the attachments of a batch and build the `/memory/write` messages. */
    async function buildMessages(entries: readonly WriteMessage[]): Promise<WriteMessage[]> {
        const cfg = getConfig();
        const out: WriteMessage[] = [];
        for (const { attachments, ...message } of entries) {
            if (attachments?.length) {
                const files = await resolveFiles(attachments as AttachmentBlock[], cfg);
                if (files.length > 0) message.files = files;
            }
            out.push(message);
        }
        return out;
    }

    /**
     * Send one session's pending turns in a single `/memory/write` call.
     * Fire-and-forget: never blocks or fails the agent.
     */
    function flush(id: string, reason: string): void {
        const batch = pending.get(id);
        if (!batch) return;
        clearTimeout(batch.timer);
        pending.delete(id);
        if (batch.messages.length === 0) return;
        buildMessages(batch.messages)
            .then((messages) => client.write(messages))
            .then(
                (data) => ctx.logger.info(`[${NAME}] write (${reason}, ${batch.turns} turn(s)) queued for session ${id}: ${JSON.stringify(data)}`),
                (error: unknown) => ctx.logger.warn(`[${NAME}] write (${reason}) failed for session ${id}: ${errorText(error)}`),
            );
    }

    function flushAll(reason: string): void {
        for (const id of [...pending.keys()]) flush(id, reason);
    }

    /** (Re)arm the idle flush for one session's pending turns. */
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
        if (!cfg.write || missingConfig(cfg).length > 0) return;
        const id = String(session.id);
        switch (event.type) {
            case 'turn/start': {
                turns.set(id, { user: [], assistant: '', startedAt: event.time ?? Date.now() });
                // A new turn means the session is not idle; the timer re-arms at turn end.
                const batch = pending.get(id);
                if (batch) clearTimeout(batch.timer);
                return;
            }
            case 'user/message': {
                const state = turns.get(id);
                const message = event.data as Message | undefined;
                if (state && isHumanMessage(message)) {
                    const blocks = messageAttachments(message, cfg.attachments);
                    const text = messageText(message) || (blocks.length > 0 ? attachmentPlaceholder(blocks, cfg.language) : '');
                    if (text) state.user.push({ content: text, attachments: blocks });
                }
                return;
            }
            case 'assistant/message': {
                const state = turns.get(id);
                const text = messageText(eventData(event).message);
                // Keep the latest non-empty text: the final answer after tool steps.
                if (state && text) state.assistant = text;
                return;
            }
            case 'turn/end': {
                const state = turns.get(id);
                turns.delete(id);
                const completed = state !== undefined && eventData(event).reason?.kind === 'completed'
                    && state.user.length > 0 && Boolean(state.assistant);
                if (completed && state) {
                    const at = new Date(state.startedAt).toISOString();
                    const batch = pending.get(id) ?? { messages: [], turns: 0 };
                    batch.messages.push(
                        ...state.user.map(({ content, attachments }) => ({ role: 'user' as const, content, dialog_at: at, attachments })),
                        { role: 'assistant', content: state.assistant, dialog_at: new Date(event.time ?? Date.now()).toISOString() },
                    );
                    batch.turns += 1;
                    pending.set(id, batch);
                }
                const batch = pending.get(id);
                if (!batch) return;
                if (cfg.writeMode === 'turn') flush(id, 'turn');
                else if (cfg.writeMode === 'batch' && batch.turns >= cfg.writeEveryTurns) flush(id, 'batch');
                else armIdle(id, cfg);
                return;
            }
            default:
        }
    });

    ctx.on('session/disposed', (session: Session) => {
        const id = String(session.id);
        turns.delete(id);
        flush(id, 'session-disposed');
    });
    // Plugin unload / process shutdown: best effort, the request may not finish
    // before a headless process exits.
    ctx.effect(() => () => flushAll('dispose'), `${NAME}: flush pending writes`);

    return {
        flushAll,
        /**
         * Settings changed: a switch to `turn` (or writes off) must not strand
         * turns buffered under the old mode, and a new idle window re-arms timers.
         */
        onSettingsChange() {
            const cfg = getConfig();
            if (!cfg.write || cfg.writeMode === 'turn') flushAll('mode-change');
            else for (const id of pending.keys()) armIdle(id, cfg);
        },
    };
}
