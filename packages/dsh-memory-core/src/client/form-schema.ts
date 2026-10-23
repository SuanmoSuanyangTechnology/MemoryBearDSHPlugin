/**
 * Schema helpers for staged config forms. Each plugin keeps its own field
 * definitions; parsing/formatting and the generic types live here.
 *
 * @module dsh-memory-core/client/form-schema
 */
export interface FieldState<T> {
    /** What the control shows. */
    text: T;
    /** Whether the current value comes from the profile entry rather than the default. */
    overridden: boolean;
    /** Whether the staged draft cannot be saved. */
    invalid: boolean;
}

export type FieldSpec =
    | { kind: 'bool' }
    | { kind: 'text' }
    | { kind: 'select'; options: readonly string[] }
    | { kind: 'multi'; options: readonly string[] }
    | { kind: 'int'; min: number }
    | { kind: 'number'; min: number };

/** Field definitions of one plugin. */
export type FieldSpecMap = Record<string, FieldSpec>;

export type FieldNameOf<S extends FieldSpecMap> = keyof S & string;

type KindOf<S extends FieldSpecMap, N extends FieldNameOf<S>> = S[N]['kind'];

/** Draft representation of one field: boolean for switches, string[] for multi-select. */
export type FieldValueOf<S extends FieldSpecMap, N extends FieldNameOf<S>> = KindOf<S, N> extends 'bool'
    ? boolean
    : KindOf<S, N> extends 'multi'
        ? string[]
        : string;

/** All field states of one render. */
export type FieldStatesOf<S extends FieldSpecMap> = {
    [N in FieldNameOf<S>]: FieldState<FieldValueOf<S, N>>;
};

/** Fields whose value is a boolean. */
export type BooleanFieldNameOf<S extends FieldSpecMap> = {
    [N in FieldNameOf<S>]: FieldValueOf<S, N> extends boolean ? N : never;
}[FieldNameOf<S>];

export interface ParsedSet {
    kind: 'set';
    value: string | number | boolean | string[];
}

export interface ParsedClear {
    kind: 'clear';
}

export type ParsedField = ParsedSet | ParsedClear;

/** Field names of a definitions object, in display order. */
export function fieldNamesOf<S extends FieldSpecMap>(specs: S): Array<FieldNameOf<S>> {
    return Object.keys(specs) as Array<FieldNameOf<S>>;
}

/** Parse one field's draft text; `undefined` means the draft is invalid. */
export function parseField<S extends FieldSpecMap, N extends FieldNameOf<S>>(
    specs: S,
    field: N,
    text: unknown,
): ParsedField | undefined {
    const spec = specs[field]!;
    if (spec.kind === 'bool') return { kind: 'set', value: Boolean(text) };
    if (spec.kind === 'multi') {
        const picked = spec.options.filter((option) => Array.isArray(text) && text.includes(option));
        return picked.length > 0 ? { kind: 'set', value: picked } : undefined;
    }
    const trimmed = String(text).trim();
    if (trimmed === '') return { kind: 'clear' };
    if (spec.kind === 'text') return { kind: 'set', value: trimmed };
    if (spec.kind === 'select') return (spec.options as readonly string[]).includes(trimmed) ? { kind: 'set', value: trimmed } : undefined;
    const numeric = spec as { kind: 'int' | 'number'; min: number };
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < numeric.min) return undefined;
    if (numeric.kind === 'int' && !Number.isInteger(value)) return undefined;
    return { kind: 'set', value };
}

/** Stored scalar as display text. */
export function formatValue(value: unknown): string {
    return value === undefined || value === null ? '' : String(value);
}

/** Draft representation of a stored value: raw for bool/multi, text otherwise. */
export function formatField<S extends FieldSpecMap, N extends FieldNameOf<S>>(
    specs: S,
    field: N,
    value: unknown,
): FieldValueOf<S, N> {
    const kind: FieldSpec['kind'] = specs[field]!.kind;
    if (kind === 'bool') return Boolean(value) as FieldValueOf<S, N>;
    if (kind === 'multi') return (Array.isArray(value) ? [...value] : []) as FieldValueOf<S, N>;
    return formatValue(value) as FieldValueOf<S, N>;
}

/** Structural equality for stored draft values. */
export function sameValue(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}
