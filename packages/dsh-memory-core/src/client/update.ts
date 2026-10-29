/**
 * Browser-side update status reader. The plugin page fetches its Host route,
 * which owns the registry check and caching.
 *
 * @module dsh-memory-core/client/update
 */
import type { UpdateStatus } from '../update.js';

export type { UpdateStatus };

/** Read the update status route; failures and missing routes stay silent. */
export async function loadUpdateStatus(path: string, signal?: AbortSignal): Promise<UpdateStatus | undefined> {
    if (typeof fetch !== 'function') return undefined;
    try {
        const response = await fetch(path, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal,
        });
        if (!response.ok) return undefined;
        const body = await response.json() as UpdateStatus;
        return typeof body === 'object' && body !== null ? body : undefined;
    } catch {
        return undefined;
    }
}

/** Build the manual update command copied by the configuration page. */
export function updateCommand(packageName: string, latest: string): string {
    return [
        '# Replace PROFILE with your dsh profile name',
        `dsh plugin --profile PROFILE remove ${packageName}`,
        `dsh plugin --profile PROFILE add ${packageName}@${latest}`,
    ].join('\n');
}

/** Copy text to the clipboard, with a textarea fallback for older browsers. */
export async function copyText(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText !== undefined) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall through to the selection-based fallback.
        }
    }
    if (typeof document === 'undefined') return false;
    try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        return copied;
    } catch {
        return false;
    }
}
