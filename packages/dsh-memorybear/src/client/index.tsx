/**
 * Browser half of @redbearai/dsh-memorybear: the bundle's configuration page in
 * dsh web's Plugins panel and the right-sidebar 记忆 tab.
 *
 * @module dsh-memorybear/client
 */
import { ConfigController, fieldNamesOf } from '@redbearai/dsh-memory-core/client';
import { DEFAULT_KEY_REF, NS, PKG, SETTINGS_NS } from './constants.js';
import { FIELDS } from './form-schema.js';
import { en, zh } from './locale/index.js';
import { makePage } from './page.js';
import { applyPanel } from './panel.js';
import { installStyles } from './styles.js';
import type { MemoryBearClientContext } from './types.js';

installStyles();

/** Required client services. */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials', 'configForms'];

/** Register the dictionaries, the configuration page and the optional memory panel. */
export function apply(ctx: MemoryBearClientContext): void {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${PKG}: dictionaries`);
    // Optional: the right sidebar exists only in compositions that mount it.
    ctx.inject(['sidebarRightTabs'], (panelCtx) => applyPanel(panelCtx));
    const controller = new ConfigController(
        ctx,
        ctx.configForms.get(SETTINGS_NS),
        FIELDS,
        fieldNamesOf(FIELDS),
        { defaultKeyRef: DEFAULT_KEY_REF },
    );
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
