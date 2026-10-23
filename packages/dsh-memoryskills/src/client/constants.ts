/**
 * Constants of the browser half.
 *
 * @module dsh-memoryskills/client/constants
 */
/** Package name: the key of this bundle's `plugins.bundle.config` entry. */
export const PKG = '@redbear/dsh-memoryskills';

/** Config form namespace = the Host profile entry id (cordis.patch.yml). */
export const SETTINGS_NS = 'memoryskills-memory';

/** Locale dictionary namespace. */
export const NS = 'memoryskills';

/** Credential reference used when the entry names none (`Config.apiKeyEnv` default). */
export const DEFAULT_KEY_REF = 'MEMORYSKILLS_API_KEY';

/** Portal used when the field is empty (`DEFAULT_PORTAL` in the Host half). */
export const DEFAULT_PORTAL = 'https://memoryskills.redbearai.com';

/** Stylesheet id, also the dedupe key. */
export const STYLE_ID = `${PKG}/config.css`;
