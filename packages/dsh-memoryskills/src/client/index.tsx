/**
 * Browser half of @redbear/dsh-memoryskills: the bundle's configuration page in
 * dsh web's Plugins panel.
 *
 * @module dsh-memoryskills/client
 */
import { ConfigController, fieldNamesOf, type ClientContext } from '@redbear/dsh-memory-core/client';
import { DEFAULT_KEY_REF, NS, PKG, SETTINGS_NS } from './constants.js';
import { FIELDS } from './form-schema.js';
import { en, zh } from './locale/index.js';
import { makePage } from './page.js';
import { installStyles } from './styles.js';

installStyles();

/** Required client services. */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials', 'configForms'];

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
    ctx.effect(() => () => controller.dispose(), `${PKG}: form subscription`);
    ctx.effect(() => ctx.remote.$on('credentials/reference-updated', (ref: unknown) => {
        if (typeof ref === 'string') controller.refreshCredential(ref);
    }), `${PKG}: credential invalidations`);
    const Page = makePage(controller);
    // Shown only while the Host serves the entry (plugin enabled and mounted).
    ctx.effect(() => ctx.configForms.whileServed([SETTINGS_NS], () => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config',
        key: PKG,
        locale: NS,
    }, Page))), `${PKG}: page`);
}
