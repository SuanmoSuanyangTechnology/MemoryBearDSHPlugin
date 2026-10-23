/**
 * Editable fields of the MemorySkills configuration form. Parsing/formatting
 * and the generic controller live in @redbear/dsh-memory-core/client.
 *
 * @module dsh-memoryskills/client/form-schema
 */
import type {
    BooleanFieldNameOf,
    FieldSpecMap,
    FieldStatesOf,
    FieldValueOf,
} from '@redbear/dsh-memory-core/client';

/** Retrieval modes offered by MemorySkills. */
export const SEARCH_MODES = ['express', 'quick', 'normal', 'deep'] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

/** Editable fields and how their text maps to stored values. */
export const FIELDS = {
    portalURL: { kind: 'text' },
    profile: { kind: 'bool' },
    recall: { kind: 'bool' },
    searchSwitch: { kind: 'select', options: SEARCH_MODES },
    tool: { kind: 'bool' },
    toolSearchSwitches: { kind: 'multi', options: SEARCH_MODES },
    write: { kind: 'bool' },
    writeMode: { kind: 'select', options: ['turn', 'batch', 'idle'] },
    writeEveryTurns: { kind: 'int', min: 1 },
    writeIdleMinutes: { kind: 'number', min: 0.1 },
} as const satisfies FieldSpecMap;

export type FieldName = keyof typeof FIELDS;
export type FieldValue<N extends FieldName> = FieldValueOf<typeof FIELDS, N>;
export type FieldStates = FieldStatesOf<typeof FIELDS>;
export type BooleanFieldName = BooleanFieldNameOf<typeof FIELDS>;
