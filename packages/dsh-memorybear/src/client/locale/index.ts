/**
 * Locale dictionaries of the browser half, loaded from JSON so copy changes do
 * not touch code. The JSON is bundled into `lib/client.js` at build time; dsh
 * registers it through `ctx.locale.register`.
 *
 * @module dsh-memorybear/client/locale
 */
import enJson from './en.json' with { type: 'json' };
import zhJson from './zh.json' with { type: 'json' };

/** One language's copy, keyed by message id. */
export type LocaleDictionary = Record<string, string>;

export const zh: LocaleDictionary = zhJson;
export const en: LocaleDictionary = enJson;
