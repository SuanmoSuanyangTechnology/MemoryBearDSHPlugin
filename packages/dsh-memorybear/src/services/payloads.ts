/**
 * Shaping of MemoryBear payloads for the tool, write and panel features.
 *
 * @module dsh-memorybear/services/payloads
 */
import { COMMUNITY_ENTITIES_MAX } from '../constants.js';

/** One row of `/dashboard/end_users`. */
export interface EndUserRow {
    end_user_id?: string;
    other_id?: string;
    end_user?: { other_id?: string; [key: string]: unknown };
    tags?: unknown[];
    memory_num?: { total?: number; active_count?: number; memory_limit?: number | null };
    [key: string]: unknown;
}

/** Envelope `data` of `/dashboard/end_users`. */
export interface EndUsersData {
    items?: EndUserRow[];
    page?: unknown;
}

/** Memory tags and counts of one end user. */
export interface MemorySummary {
    tags: string[];
    total: number;
    active: number;
    limit: number | null;
}

/** One node of `/memory/analytics/community_graph`. */
export interface CommunityNode {
    id?: string;
    label?: string;
    properties?: Record<string, unknown>;
    [key: string]: unknown;
}

/** Envelope `data` of `/memory/analytics/community_graph`. */
export interface CommunityGraphData {
    nodes?: CommunityNode[];
    edges?: unknown[];
    statistics?: unknown;
}

/** One topic card shown by the memory panel. */
export interface CommunityCard {
    id: string;
    name: string;
    summary: string;
    members: number;
    entities: string[];
    updatedAt: string;
}

/**
 * This user's `other_id` from `/dashboard/end_users?keyword=` (row matched on
 * `end_user_id` exactly; the field sits on the nested `end_user` object).
 */
export function endUserOtherId(data: EndUsersData | undefined, endUserId: string): string {
    const row = (data?.items ?? []).find((item) => item?.end_user_id === endUserId);
    const value = row?.end_user?.other_id ?? row?.other_id;
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * This user's memory tags and counts from `/dashboard/end_users?keyword=`.
 * `keyword` is a fuzzy search, so the row is matched on `end_user_id` exactly.
 */
export function memorySummary(data: EndUsersData | undefined, endUserId: string): MemorySummary | null {
    const row = (data?.items ?? []).find((item) => item?.end_user_id === endUserId);
    if (!row) return null;
    const counts = row.memory_num ?? {};
    return {
        tags: (Array.isArray(row.tags) ? row.tags : []).map(String).filter(Boolean),
        total: Number(counts.total) || 0,
        active: Number(counts.active_count) || 0,
        limit: counts.memory_limit === null || counts.memory_limit === undefined ? null : Number(counts.memory_limit),
    };
}

/**
 * Topic cards from `/memory/analytics/community_graph`: only the `Community`
 * nodes, largest first. Entity nodes and edges are dropped server-side of the
 * panel route, so the browser gets a few hundred bytes, not the whole graph.
 */
export function communityCards(data: CommunityGraphData | undefined): CommunityCard[] {
    return (data?.nodes ?? [])
        .filter((node) => node?.label === 'Community' && node.properties !== undefined)
        .map((node) => {
            const properties = node.properties ?? {};
            const entities = (Array.isArray(properties.core_entities) ? properties.core_entities : [])
                .filter((entity): entity is string => typeof entity === 'string' && Boolean(entity.trim()) && entity !== '用户')
                .slice(0, COMMUNITY_ENTITIES_MAX);
            return {
                id: String(properties.community_id ?? node.id),
                name: String(properties.name ?? '').trim(),
                summary: String(properties.summary ?? '').trim(),
                members: Number(properties.member_count) || 0,
                entities,
                updatedAt: typeof properties.updated_at === 'string' ? properties.updated_at : '',
            };
        })
        .filter((card) => card.name || card.summary)
        .sort((a, b) => b.members - a.members);
}

/** MemoryBear `FileInput.type` for a file name, by the extensions its parsers route. */
const FILE_KINDS: ReadonlyArray<readonly [string, RegExp]> = Object.freeze([
    ['image', /\.(png|jpe?g|webp|gif)$/i],
    ['audio', /\.(wav|wave|mp3|aac|flac|ogg|aiff|au|wma|ape|m4a)$/i],
    ['video', /\.(mp4|mov|avi|flv|mpeg|mpg|webm|wmv|3gpp?|mkv)$/i],
    ['document', /\.(pdf|docx?|pptx?|xlsx?|csv|txt|md|markdown|html?|json|jsonl)$/i],
]);

export type FileKind = 'image' | 'audio' | 'video' | 'document';

/** MemoryBear file kind for a file name; `undefined` when it cannot parse the type. */
export function fileKind(fileName: string): FileKind | undefined {
    return FILE_KINDS.find(([, pattern]) => pattern.test(fileName ?? ''))?.[0] as FileKind | undefined;
}
