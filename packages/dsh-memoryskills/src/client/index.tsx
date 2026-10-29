/**
 * Browser half of @redbearai/dsh-memoryskills: the bundle's configuration page in
 * dsh web's Plugins panel.
 *
 * @module dsh-memoryskills/client
 */
import { ConfigController, fieldNamesOf, refreshSettingsNamespace, type ClientContext } from '@redbearai/dsh-memory-core/client';
import { DEFAULT_KEY_REF, NS, PKG, SETTINGS_NS } from './constants.js';
import { FIELDS } from './form-schema.js';
import { en, zh } from './locale/index.js';
import { makePage } from './page.js';
import { installStyles } from './styles.js';

installStyles();

/** Required client services. */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials', 'remote.settings', 'configForms'];

/** Register the dictionaries and this bundle's configuration page. */
export function apply(ctx: ClientContext): void {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${PKG}: dictionaries`);
    const controller = new ConfigController(
        ctx,
        ctx.configForms.get(SETTINGS_NS),
        FIELDS,
        fieldNamesOf(FIELDS),
        {
            defaultKeyRef: DEFAULT_KEY_REF,
            isKeyInvalid: (key) => key !== '' && !key.startsWith('sk-mem-'),
        },
    );
    let refreshingSettings = false;
    const refreshSettings = (): void => {
        if (refreshingSettings || controller.getSnapshot().available) return;
        refreshingSettings = true;
        void refreshSettingsNamespace(ctx, SETTINGS_NS).finally(() => { refreshingSettings = false; });
    };
    refreshSettings();
    ctx.effect(() => ctx.remote.$on('plugin-manager/changed', refreshSettings), `${PKG}: settings refresh`);
    ctx.effect(() => () => controller.dispose(), `${PKG}: form subscription`);
    ctx.effect(() => ctx.remote.$on('credentials/reference-updated', (ref: unknown) => {
        if (typeof ref === 'string') controller.refreshCredential(ref);
    }), `${PKG}: credential invalidations`);
    const Page = makePage(controller);
    // Register like an official bundle config page: the client module exists only
    // while the bundle is mounted, so a separate namespace gate would keep the
    // page hidden after a hot install until the browser settings mirror refreshes.
    ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config',
        key: PKG,
        locale: NS,
    }, Page)), `${PKG}: page`);
}
