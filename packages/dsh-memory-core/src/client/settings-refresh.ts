/**
 * Refresh one settings namespace after a hot plugin install. The Web client's
 * settings mirror only re-reads on settings events; adding a bundle emits none,
 * so a newly installed config page would otherwise wait for a manual reload.
 *
 * @module dsh-memory-core/client/settings-refresh
 */
import type { ConfigFormsService, RemoteService, SettingsNamespaceView } from './types.js';

export interface SettingsRefreshContext {
    readonly remote: RemoteService;
    readonly configForms: ConfigFormsService;
}

/**
 * Ask the Host for the current settings document and fold this namespace into
 * the shared browser mirror. Failures stay silent; the normal invalidation
 * path still applies.
 */
export async function refreshSettingsNamespace(ctx: SettingsRefreshContext, namespace: string): Promise<void> {
    const settings = ctx.remote?.settings;
    if (settings === undefined) return;
    try {
        const response = await settings.describe();
        if (!response.ok || response.value === undefined) return;
        const view: SettingsNamespaceView | undefined = response.value.namespaces.find((item) => item.ns === namespace);
        if (view !== undefined) ctx.configForms.describe().acceptView(view);
    } catch {
        // Keep silent: the config page remains in its loading state until the next refresh.
    }
}
