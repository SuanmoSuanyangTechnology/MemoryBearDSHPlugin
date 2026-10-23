/**
 * Fill `{name}` placeholders in locale copy.
 *
 * @module dsh-memory-core/client/utils
 */
export function fill(text: string, vars?: Record<string, string | number>): string {
    return String(text).replace(/\{(\w+)\}/g, (all, key: string) => (vars && key in vars ? String(vars[key]) : all));
}
