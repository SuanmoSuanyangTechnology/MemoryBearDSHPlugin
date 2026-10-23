/**
 * HTTP URL construction shared by the MemoryBear and MemorySkills clients.
 * Route tables stay in each plugin; joining and query encoding live here.
 *
 * @module dsh-memory-core/http/url
 */

/** Scalar query parameter; `undefined` entries are dropped. */
export type QueryValue = string | number | boolean;
export type QueryParams = Record<string, QueryValue | undefined>;

/** Base URL without trailing slashes. */
export function normalizeBaseUrl(url: unknown): string {
    return String(url ?? '').trim().replace(/\/+$/, '');
}

/** Join base URL + API path + query parameters. */
export function buildApiUrl(baseURL: string, path: string, query?: QueryParams): string {
    const base = normalizeBaseUrl(baseURL);
    const suffix = path.startsWith('/') ? path : `/${path}`;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined) params.append(key, String(value));
    }
    const search = params.toString();
    return `${base}${suffix}${search ? `?${search}` : ''}`;
}
