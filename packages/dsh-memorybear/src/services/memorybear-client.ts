/**
 * MemoryBear V1 client: transport and response handling. Every route and
 * request payload comes from `services/api.ts`, so URLs and parameters are
 * managed in one place.
 *
 * Reads the config and key on every call, so edits from the Plugins page apply
 * to the next request without a restart.
 *
 * @module dsh-memorybear/services/memorybear-client
 */
import { PREFERENCE_MESSAGE_MAX_CHARS } from '../constants.js';
import { missingConfig, type ConfigSnapshot } from '../config.js';
import {
    API_PATHS,
    buildApiUrl,
    communityGraphRequest,
    emotionOverviewRequest,
    emotionTimelineRequest,
    endUsersRequest,
    preferenceRecallRequest,
    readSyncRequest,
    uploadFileRequest,
    writeRequest,
    type ApiRequest,
    type PreferenceContextMessage,
    type WriteMessage,
} from './api.js';
import {
    endUserOtherId,
    memorySummary,
    communityCards,
    type CommunityCard,
    type CommunityGraphData,
    type EndUsersData,
    type MemorySummary,
} from './payloads.js';
import { profileEntity, renderProfile, type ProfileEntity, type ReadSyncData } from './profile.js';
import type { Preference } from './render.js';

export type { MemoryBearFile, PreferenceContextMessage, WriteMessage } from './api.js';

/** One emotion bucket of one day. */
export interface EmotionRow {
    type?: string;
    display_name?: string;
    count?: number;
    percentage?: number;
    [key: string]: unknown;
}

/** One day of the emotion timeline. */
export interface EmotionDay {
    date?: string;
    dialogue_count?: number;
    emotions?: EmotionRow[];
    [key: string]: unknown;
}

/** `/memory/emotion-memory/query_emotion_overview` data. */
export interface EmotionOverview {
    data_quality?: string;
    conclusion?: { title?: string; message?: string };
    [key: string]: unknown;
}

/** Envelope `data` of the emotion timeline endpoint. */
export interface EmotionTimeline {
    items?: EmotionDay[];
    page?: unknown;
}

/** One panel part: its data, or the error that kept it unavailable. */
export type InsightPart<T> = { ok: true; data: T } | { ok: false; error: string };

/** Everything the memory panel shows. */
export interface Insights {
    profile: InsightPart<ProfileEntity | null>;
    overview: InsightPart<EmotionOverview>;
    timeline: InsightPart<EmotionTimeline>;
    memory: InsightPart<MemorySummary | null>;
    communities: InsightPart<CommunityCard[]>;
}

/** File handed to `/memory/files/upload`. */
export interface UploadFile {
    data: Uint8Array;
    name: string;
    mediaType?: string;
}

interface JsonEnvelope<T> {
    code: number;
    msg?: string;
    data: T;
    error?: string;
}

interface RequestOptions {
    timeoutMs: number;
    signal?: AbortSignal;
}

/** MemoryBear V1 client used by the recall, write, tool and panel features. */
export interface MemoryBearClient {
    read(query: string, signal?: AbortSignal, options?: { searchSwitch?: string; timeoutMs?: number }): Promise<string>;
    profile(query: string, signal?: AbortSignal): Promise<string>;
    otherId(signal?: AbortSignal): Promise<string>;
    preferences(message: string, context: PreferenceContextMessage[], signal?: AbortSignal): Promise<Preference[]>;
    write(messages: WriteMessage[]): Promise<unknown>;
    upload(file: UploadFile): Promise<string>;
    insights(timeZone: string): Promise<Insights>;
}

function part<T>(result: PromiseSettledResult<T>): InsightPart<T> {
    return result.status === 'fulfilled'
        ? { ok: true, data: result.value }
        : { ok: false, error: String(result.reason instanceof Error ? result.reason.message : result.reason) };
}

/** Create the client for one plugin instance. */
export function createMemoryBearClient(
    getConfig: () => ConfigSnapshot,
    resolveKey: (config: ConfigSnapshot) => Promise<string | undefined>,
): MemoryBearClient {
    /** `baseURL|endUserId` -> resolved `other_id`. */
    const otherIds = new Map<string, string>();

    /** Send one request built by `api.ts` and unwrap the `{code,msg,data}` envelope. */
    async function send<T>(config: ConfigSnapshot, request: ApiRequest, { timeoutMs, signal }: RequestOptions): Promise<T> {
        const missing = missingConfig(config);
        if (missing.length > 0) throw new Error(`MemoryBear not configured: set ${missing.join(', ')} on the Plugins page or in the profile patch`);
        const key = await resolveKey(config);
        const headers: Record<string, string> = {
            ...request.headers,
            Authorization: `Bearer ${key ?? ''}`,
        };
        let body: BodyInit | undefined;
        if (request.form !== undefined) {
            body = request.form;
        } else if (request.json !== undefined) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(request.json);
        }
        const signals = [AbortSignal.timeout(timeoutMs)];
        if (signal) signals.push(signal);
        const res = await fetch(buildApiUrl(config.baseURL, request.path, request.query), {
            method: request.method,
            headers,
            body,
            signal: AbortSignal.any(signals),
        });
        const text = await res.text();
        let json: JsonEnvelope<T>;
        try {
            json = JSON.parse(text) as JsonEnvelope<T>;
        } catch {
            throw new Error(`HTTP ${res.status}: non-JSON response`);
        }
        if (!res.ok || json.code !== 0) {
            throw new Error(`HTTP ${res.status} code=${json.code} msg=${json.msg ?? ''} ${json.error ?? ''}`.trim());
        }
        return json.data;
    }

    async function endpointOtherId(signal?: AbortSignal): Promise<string> {
        const config = getConfig();
        const cacheKey = `${config.baseURL}|${config.endUserId}`;
        const hit = otherIds.get(cacheKey);
        if (hit) return hit;
        const data = await send<EndUsersData>(config, endUsersRequest(config.endUserId), {
            timeoutMs: config.preferenceTimeoutMs,
            signal,
        });
        const value = endUserOtherId(data, config.endUserId);
        if (!value) throw new Error(`no other_id for end_user ${config.endUserId} in ${API_PATHS.endUsers}`);
        otherIds.set(cacheKey, value);
        return value;
    }

    return {
        async read(query, signal, options = {}) {
            const config = getConfig();
            const data = await send<ReadSyncData>(config, readSyncRequest({
                message: query,
                searchSwitch: options.searchSwitch ?? config.searchSwitch,
                endUserId: config.endUserId,
            }), {
                timeoutMs: options.timeoutMs ?? config.recallTimeoutMs,
                signal,
            });
            return typeof data?.answer === 'string' ? data.answer.trim() : '';
        },

        async profile(query, signal) {
            const config = getConfig();
            const data = await send<ReadSyncData>(config, readSyncRequest({
                message: query,
                searchSwitch: 'meta',
                endUserId: config.endUserId,
            }), {
                timeoutMs: config.recallTimeoutMs,
                signal,
            });
            return renderProfile(data);
        },

        async otherId(signal) {
            return endpointOtherId(signal);
        },

        async preferences(message, context, signal) {
            const config = getConfig();
            const otherId = await endpointOtherId(signal);
            const data = await send<{ preferences?: unknown[] }>(config, preferenceRecallRequest({
                message: message.slice(0, PREFERENCE_MESSAGE_MAX_CHARS),
                context,
                otherId,
            }), {
                timeoutMs: config.preferenceTimeoutMs,
                signal,
            });
            return (Array.isArray(data?.preferences) ? data.preferences : [])
                .filter((item): item is Preference => {
                    if (item === null || typeof item !== 'object') return false;
                    const preference = item as Partial<Preference>;
                    return typeof preference.preference_text === 'string' && Boolean(preference.preference_text.trim());
                });
        },

        async write(messages) {
            const config = getConfig();
            return send<unknown>(config, writeRequest({
                messages,
                endUserId: config.endUserId,
                language: config.language,
            }), {
                timeoutMs: config.writeTimeoutMs,
            });
        },

        async upload({ data, name, mediaType }) {
            const config = getConfig();
            const form = new FormData();
            form.append('file', new Blob([data as BlobPart], mediaType ? { type: mediaType } : {}), name);
            // No Content-Type header: fetch sets the multipart boundary itself.
            const result = await send<{ file_id?: unknown }>(config, uploadFileRequest(form), {
                timeoutMs: config.uploadTimeoutMs,
            });
            if (!result?.file_id) throw new Error(`upload of ${name} returned no file_id`);
            return String(result.file_id);
        },

        async insights(timeZone) {
            const config = getConfig();
            const options: RequestOptions = { timeoutMs: config.panelTimeoutMs };
            const [profile, overview, timeline, memory, communities] = await Promise.allSettled([
                send<ReadSyncData>(config, readSyncRequest({
                    message: 'profile',
                    searchSwitch: 'meta',
                    endUserId: config.endUserId,
                }), options).then((data) => profileEntity(data) ?? null),
                send<EmotionOverview>(config, emotionOverviewRequest({
                    endUserId: config.endUserId,
                    timeZone,
                    language: config.language,
                }), options),
                send<EmotionTimeline>(config, emotionTimelineRequest({
                    endUserId: config.endUserId,
                    timeZone,
                    language: config.language,
                }), options),
                send<EndUsersData>(config, endUsersRequest(config.endUserId, config.language), options)
                    .then((data) => memorySummary(data, config.endUserId)),
                send<CommunityGraphData>(config, communityGraphRequest({
                    endUserId: config.endUserId,
                    language: config.language,
                }), options).then((data) => communityCards(data)),
            ]);
            return {
                profile: part(profile),
                overview: part(overview),
                timeline: part(timeline),
                memory: part(memory),
                communities: part(communities),
            };
        },
    };
}
