/**
 * Editable fields of the MemoryBear configuration form. Parsing/formatting and
 * the generic controller live in @redbearai/dsh-memory-core/client.
 *
 * @module dsh-memorybear/client/form-schema
 */
import type {
    BooleanFieldNameOf,
    FieldSpecMap,
    FieldStatesOf,
    FieldValueOf,
} from '@redbearai/dsh-memory-core/client';

/** Retrieval modes offered by MemoryBear. */
export const SEARCH_MODES = ['express', 'quick', 'normal', 'deep'] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

/** Editable fields and how their text maps to stored values. */
export const FIELDS = {
    baseURL: { kind: 'text' },
    endUserId: { kind: 'text' },
    profile: { kind: 'bool' },
    recall: { kind: 'bool' },
    preferenceMode: { kind: 'select', options: ['auto', 'tool', 'off'] },
    preferenceContextMessages: { kind: 'int', min: 0 },
    preferenceTimeoutMs: { kind: 'int', min: 1 },
    searchSwitch: { kind: 'select', options: SEARCH_MODES },
    toolSearchSwitches: { kind: 'multi', options: SEARCH_MODES },
    write: { kind: 'bool' },
    writeMode: { kind: 'select', options: ['turn', 'batch', 'idle'] },
    writeEveryTurns: { kind: 'int', min: 1 },
    writeIdleMinutes: { kind: 'number', min: 0.1 },
    attachments: { kind: 'select', options: ['none', 'images', 'all'] },
    panel: { kind: 'bool' },
    updateCheck: { kind: 'bool' },
} as const satisfies FieldSpecMap;

export type FieldName = keyof typeof FIELDS;
export type FieldValue<N extends FieldName> = FieldValueOf<typeof FIELDS, N>;
export type FieldStates = FieldStatesOf<typeof FIELDS>;
export type BooleanFieldName = BooleanFieldNameOf<typeof FIELDS>;
