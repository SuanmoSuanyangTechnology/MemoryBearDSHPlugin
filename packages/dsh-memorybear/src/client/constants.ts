/**
 * Constants of the browser half.
 *
 * @module dsh-memorybear/client/constants
 */

/** Package name: the key of this bundle's `plugins.bundle.config` entry. */
export const PKG = '@redbearai/dsh-memorybear';

/** Config form namespace = the Host profile entry id (cordis.patch.yml). */
export const SETTINGS_NS = 'memorybear-memory';

/** Locale dictionary namespace. */
export const NS = 'memorybear';

/** Credential reference used when the section names none (`Config.apiKeyEnv` default). */
export const DEFAULT_KEY_REF = 'MEMORYBEAR_API_KEY';

/** dsh host route that exposes the memory panel payload (single source: `src/constants.ts`). */
export { INSIGHTS_PATH, UPDATE_PATH } from '../constants.js';

/** Stylesheet id, also the dedupe key. */
export const STYLE_ID = `${PKG}/config.css`;

/** Tab type id; also the slot key its body registers under. */
export const PANEL_ID = `${PKG}/panel`;
