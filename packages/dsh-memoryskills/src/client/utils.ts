/**
 * Small browser-side helpers specific to the MemorySkills page.
 *
 * @module dsh-memoryskills/client/utils
 */
import { DEFAULT_PORTAL } from './constants.js';

/** `https://host/` -> `https://host/#/login` (the Portal's email sign-in page). */
export function loginURL(portal: string): string {
    const root = String(portal || DEFAULT_PORTAL).trim().replace(/\/+$/, '');
    return /^https?:\/\//.test(root) ? `${root}/#/login` : `${DEFAULT_PORTAL}/#/login`;
}
