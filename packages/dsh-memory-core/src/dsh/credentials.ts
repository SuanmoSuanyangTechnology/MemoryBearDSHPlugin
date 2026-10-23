/**
 * Credential resolution shared by the memory plugins.
 *
 * @module dsh-memory-core/dsh/credentials
 */
import type { PluginContext } from './types.js';

/** `error.message` when available, else a stringified value. */
export function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Resolve an API key for one call: dsh's credential store first (launch env,
 * `.credentials.yaml`, `.env`), then the raw process env.
 */
export async function resolveCredential(ctx: PluginContext, ref: string, pluginName: string): Promise<string | undefined> {
    const credentials = ctx.get('credentials');
    if (credentials !== undefined) {
        try {
            const hit = await credentials.resolve(ref);
            if (hit?.value) return hit.value.trim();
        } catch (error) {
            ctx.logger.warn(`[${pluginName}] credential ${ref} lookup failed: ${errorText(error)}`);
        }
    }
    return process.env[ref]?.trim() || undefined;
}
