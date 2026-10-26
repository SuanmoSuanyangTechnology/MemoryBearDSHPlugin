/**
 * Single source of truth for MemoryBear V1 routes and request construction.
 *
 * Every outbound request goes through `buildApiUrl` and one of the builders
 * below, so paths, query parameters, headers and JSON envelopes are managed in
 * one place. Transport (auth, timeout, envelope unwrapping) lives in
 * `memorybear-client.ts`.
 *
 * @module dsh-memorybear/services/api
 */

import type { QueryParams } from '@redbearai/dsh-memory-core';

export { buildApiUrl, normalizeBaseUrl } from '@redbearai/dsh-memory-core';
export type { QueryParams, QueryValue } from '@redbearai/dsh-memory-core';

/** Paths under the configured V1 base URL (which normally ends in `/v1`). */
export const API_PATHS = {
    readSync: '/memory/read/sync',
    write: '/memory/write',
    uploadFile: '/memory/files/upload',
    endUsers: '/dashboard/end_users',
    preferenceRecall: '/memory/preference/recall',
    emotionOverview: '/memory/emotion-memory/query_emotion_overview',
    emotionTimeline: '/memory/emotion-memory/query_emotion_timeline',
    communityGraph: '/memory/analytics/community_graph',
} as const;

export type ApiPathName = keyof typeof API_PATHS;


/** One HTTP request before transport concerns (auth, timeout, envelope). */
export interface ApiRequest {
    readonly method: 'GET' | 'POST';
    readonly path: string;
    readonly query?: QueryParams;
    /** JSON body; the transport serializes it and sets Content-Type. */
    readonly json?: unknown;
    /** Multipart body; the transport sends it as-is. */
    readonly form?: FormData;
    readonly headers?: Record<string, string>;
}

/** Message shape sent to `/memory/write`. */
export interface WriteMessage {
    role: 'user' | 'assistant';
    content: string;
    dialog_at?: string;
    files?: MemoryBearFile[];
    /** Collected from the dsh message; stripped before the request. */
    attachments?: unknown[];
}

/** One `FileInput` entry of `/memory/write`. */
export interface MemoryBearFile {
    type: string;
    transfer_method: 'local_file';
    upload_file_id: string;
    name: string;
    size: number;
    file_type?: string;
}

/** Earlier exchanges sent with a preference request. */
export interface PreferenceContextMessage {
    role: 'user' | 'assistant';
    content: string;
}

function languageHeader(language: string): Record<string, string> {
    return { 'X-Language-Type': language };
}

export interface ReadSyncInput {
    message: string;
    searchSwitch: string;
    endUserId: string;
}

/** `POST /memory/read/sync` — profile, per-turn recall and memory_search. */
export function readSyncRequest({ message, searchSwitch, endUserId }: ReadSyncInput): ApiRequest {
    return {
        method: 'POST',
        path: API_PATHS.readSync,
        json: { message, search_switch: searchSwitch, end_user_id: endUserId },
    };
}

export interface WriteInput {
    messages: readonly WriteMessage[];
    endUserId: string;
    language: string;
}

/** `POST /memory/write`. */
export function writeRequest({ messages, endUserId, language }: WriteInput): ApiRequest {
    return {
        method: 'POST',
        path: API_PATHS.write,
        json: { messages, end_user_id: endUserId },
        headers: languageHeader(language),
    };
}

/** `POST /memory/files/upload` (multipart form). */
export function uploadFileRequest(form: FormData): ApiRequest {
    return { method: 'POST', path: API_PATHS.uploadFile, form };
}

/** `GET /dashboard/end_users?keyword=`. */
export function endUsersRequest(keyword: string, language?: string): ApiRequest {
    return {
        method: 'GET',
        path: API_PATHS.endUsers,
        query: { keyword },
        ...(language === undefined ? {} : { headers: languageHeader(language) }),
    };
}

export interface PreferenceRecallInput {
    message: string;
    context: readonly PreferenceContextMessage[];
    otherId: string;
}

/** `POST /memory/preference/recall`. */
export function preferenceRecallRequest({ message, context, otherId }: PreferenceRecallInput): ApiRequest {
    return {
        method: 'POST',
        path: API_PATHS.preferenceRecall,
        json: { current_user_message: message, context_messages: context },
        headers: { 'X-End-User-Other-Id': otherId },
    };
}

export interface EmotionQueryInput {
    endUserId: string;
    timeZone: string;
    language: string;
}

/** `GET /memory/emotion-memory/query_emotion_overview`. */
export function emotionOverviewRequest({ endUserId, timeZone, language }: EmotionQueryInput): ApiRequest {
    return {
        method: 'GET',
        path: API_PATHS.emotionOverview,
        query: { end_user_id: endUserId },
        headers: { ...languageHeader(language), 'X-Timezone': timeZone },
    };
}

/** `GET /memory/emotion-memory/query_emotion_timeline?sort=desc&page=1&pagesize=14`. */
export function emotionTimelineRequest({ endUserId, timeZone, language }: EmotionQueryInput): ApiRequest {
    return {
        method: 'GET',
        path: API_PATHS.emotionTimeline,
        query: { end_user_id: endUserId, sort: 'desc', page: 1, pagesize: 14 },
        headers: { ...languageHeader(language), 'X-Timezone': timeZone },
    };
}

export interface CommunityGraphInput {
    endUserId: string;
    language: string;
}

/** `GET /memory/analytics/community_graph`. */
export function communityGraphRequest({ endUserId, language }: CommunityGraphInput): ApiRequest {
    return {
        method: 'GET',
        path: API_PATHS.communityGraph,
        query: { end_user_id: endUserId },
        headers: languageHeader(language),
    };
}
