/**
 * Version comparison and a notify-only npm update checker. It never installs
 * anything: callers expose the result and leave upgrading to the user.
 *
 * @module dsh-memory-core/update
 */
import { normalizeBaseUrl } from './http/url.js';

/** Result of one update check. */
export interface UpdateStatus {
    /** False when the user disabled update checks. */
    enabled: boolean;
    /** Version currently loaded by the plugin. */
    current: string;
    /** Version published under the package's `latest` dist-tag. */
    latest?: string;
    /** Whether `latest` is newer than `current`. */
    available: boolean;
    /** `<package>@<latest>` install spec when an update is available. */
    spec?: string;
    /** ISO timestamp of the registry read. */
    checkedAt?: string;
    /** Registry/network failure text; the check never throws. */
    error?: string;
}

export interface UpdateCheckerOptions {
    /** npm package name, e.g. `@redbearai/dsh-memorybear`. */
    packageName: string;
    /** Version of the package currently loaded. */
    currentVersion: string;
    /** Read the live `updateCheck` preference. */
    isEnabled: () => boolean;
    /** Registry root; defaults to `https://registry.npmjs.org`. */
    registry?: string;
    /** Reuse a result for this long; defaults to 24 hours. */
    intervalMs?: number;
    /** Network timeout; defaults to 3 seconds. */
    timeoutMs?: number;
    /** Injectable fetch for tests. */
    fetchImpl?: typeof fetch;
    /** Injectable clock for tests. */
    now?: () => number;
}

export interface UpdateChecker {
    /** Read the latest version, reusing a fresh cached result unless `force`. */
    check(force?: boolean): Promise<UpdateStatus>;
}

interface ParsedVersion {
    core: [number, number, number];
    pre: string[];
}

const VERSION_PATTERN = /^[vV]?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parseVersion(value: string): ParsedVersion | undefined {
    const match = VERSION_PATTERN.exec(String(value).trim());
    if (!match) return undefined;
    return {
        core: [Number(match[1]), Number(match[2]), Number(match[3])],
        pre: match[4] === undefined ? [] : match[4].split('.'),
    };
}

function compareIdentifier(a: string, b: string): number {
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return Number(a) === Number(b) ? 0 : Number(a) < Number(b) ? -1 : 1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a === b ? 0 : a < b ? -1 : 1;
}

/**
 * Compare two semantic versions. Invalid versions compare equal (0), which
 * makes the update check stay quiet rather than claim a bogus update.
 */
export function compareVersions(left: string, right: string): number {
    const a = parseVersion(left);
    const b = parseVersion(right);
    if (a === undefined || b === undefined) return 0;
    for (let index = 0; index < 3; index += 1) {
        if (a.core[index] !== b.core[index]) return a.core[index]! < b.core[index]! ? -1 : 1;
    }
    if (a.pre.length === 0 && b.pre.length === 0) return 0;
    if (a.pre.length === 0) return 1;
    if (b.pre.length === 0) return -1;
    const length = Math.min(a.pre.length, b.pre.length);
    for (let index = 0; index < length; index += 1) {
        const result = compareIdentifier(a.pre[index]!, b.pre[index]!);
        if (result !== 0) return result;
    }
    return a.pre.length === b.pre.length ? 0 : a.pre.length < b.pre.length ? -1 : 1;
}

/** Whether `latest` is strictly newer than `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
    return compareVersions(latest, current) > 0;
}

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** Create a cached, notify-only update checker. */
export function createUpdateChecker(options: UpdateCheckerOptions): UpdateChecker {
    const intervalMs = options.intervalMs ?? 24 * 60 * 60 * 1000;
    const errorIntervalMs = Math.min(intervalMs, 5 * 60 * 1000);
    const timeoutMs = options.timeoutMs ?? 5_000;
    const now = options.now ?? Date.now;
    let cached: { at: number; status: UpdateStatus } | undefined;
    let inFlight: Promise<UpdateStatus> | undefined;

    async function read(): Promise<UpdateStatus> {
        const current = options.currentVersion;
        const fetchImpl = options.fetchImpl ?? globalThis.fetch;
        const checkedAt = () => new Date(now()).toISOString();
        if (typeof fetchImpl !== 'function') {
            return { enabled: true, current, available: false, checkedAt: checkedAt(), error: 'fetch is unavailable' };
        }
        const registry = normalizeBaseUrl(options.registry ?? 'https://registry.npmjs.org');
        const url = `${registry}/${encodeURIComponent(options.packageName)}/latest`;
        try {
            const response = await fetchImpl(url, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (!response.ok) {
                return { enabled: true, current, available: false, checkedAt: checkedAt(), error: `HTTP ${response.status}` };
            }
            const body = await response.json() as { version?: unknown };
            if (typeof body.version !== 'string' || !body.version.trim()) {
                return { enabled: true, current, available: false, checkedAt: checkedAt(), error: 'registry response has no version' };
            }
            const latest = body.version.trim();
            const available = isNewerVersion(latest, current);
            return {
                enabled: true,
                current,
                latest,
                available,
                ...(available ? { spec: `${options.packageName}@${latest}` } : {}),
                checkedAt: checkedAt(),
            };
        } catch (error) {
            return { enabled: true, current, available: false, checkedAt: checkedAt(), error: errorText(error) };
        }
    }

    async function check(force = false): Promise<UpdateStatus> {
        if (!options.isEnabled()) {
            return { enabled: false, current: options.currentVersion, available: false };
        }
        const cacheMs = cached?.status.error === undefined ? intervalMs : errorIntervalMs;
        if (!force && cached !== undefined && now() - cached.at < cacheMs) return cached.status;
        if (inFlight !== undefined) return inFlight;
        inFlight = read().then((status) => {
            cached = { at: now(), status };
            return status;
        }).finally(() => {
            inFlight = undefined;
        });
        return inFlight;
    }

    return { check };
}
