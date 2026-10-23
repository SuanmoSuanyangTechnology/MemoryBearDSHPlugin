/**
 * Parsing and rendering of the MemoryBear `meta` profile.
 *
 * @module dsh-memorybear/services/profile
 */

/** Profile fields of a `meta` ExtractedEntity, with their rendered labels. */
export const PROFILE_FIELDS = [
    ['core_facts', 'Core facts'],
    ['traits', 'Traits'],
    ['interests', 'Interests'],
    ['goals', 'Goals'],
    ['beliefs_or_stances', 'Beliefs / stances'],
    ['relations', 'Relations'],
    ['event_timeline', 'Event timeline'],
    ['anchors', 'Anchors'],
] as const;

export type ProfileFieldKey = (typeof PROFILE_FIELDS)[number][0];

/** Structured profile shown by the memory panel. */
export interface ProfileEntity {
    summary: string;
    fields: Array<{ key: string; label: string; items: string[] }>;
    description: string;
}

/** A `meta` read/sync payload. */
export interface ReadSyncData {
    answer?: unknown;
    intermediate_outputs?: Array<{ data?: unknown }>;
    [key: string]: unknown;
}

/** Render one profile field value (string or object) as a single line. */
function profileItem(item: unknown): string {
    return typeof item === 'string' ? item : JSON.stringify(item);
}

/** `['a', 'b']`, `a；b` or `a, b` -> ['a', 'b']. */
function listItems(body: string): string[] {
    const value = String(body).trim();
    const inner = /^\[[\s\S]*\]$/.test(value) ? value.slice(1, -1) : value;
    const parts = /^\[/.test(value) ? inner.split(/['"]\s*,\s*['"]/) : inner.split(/[；;\n]/);
    return parts.map((part) => part.replace(/^['"\s]+|['"\s]+$/g, '')).filter(Boolean);
}

/** `[start|end] desc|title|category|code；...` -> ['start 标题', ...] (date range collapsed when equal). */
function timelineItems(body: string): string[] {
    return String(body).split(/；|;\s*(?=\[)/).map((entry) => {
        const match = entry.trim().match(/^\[([^|\]]*)\|?([^\]]*)\]\s*([\s\S]*)$/);
        if (!match) return entry.trim();
        const [, start = '', end = '', tail = ''] = match;
        const [desc = '', title = ''] = tail.split('|');
        const when = !end || end === start ? start : `${start} ~ ${end}`;
        return `${when} ${(title || desc || '').trim()}`.trim();
    }).filter(Boolean);
}

/**
 * Split the `meta` answer text into its `<field>...</field>` sections.
 *
 * The server renders profile fields inline, e.g.
 * `<event_timeline>[2026-01-23|2026-01-23] desc|title|category|code；...</event_timeline>`
 * and `<interests>['a', 'b']</interests>`. Known PROFILE_FIELDS sections become
 * item lists; whatever text is left outside the tags is returned as `rest`.
 */
export function parseProfileSections(text: string): { rest: string; sections: Record<string, string[]> } {
    const sections: Record<string, string[]> = {};
    const known = new Set<string>(PROFILE_FIELDS.map(([key]) => key));
    const rest = String(text ?? '').replace(/<([a-z_]+)>([\s\S]*?)<\/\1>/g, (whole, key: string, body: string) => {
        if (!known.has(key)) return whole;
        sections[key] = key === 'event_timeline' ? timelineItems(body) : listItems(body);
        return ' ';
    }).replace(/\s+/g, ' ').trim();
    return { rest, sections };
}

function intermediateEntities(data: ReadSyncData): Array<Record<string, unknown>> {
    const out: Array<Record<string, unknown>> = [];
    for (const output of Array.isArray(data?.intermediate_outputs) ? data.intermediate_outputs : []) {
        const entity = output?.data;
        if (entity !== null && typeof entity === 'object' && !Array.isArray(entity)) out.push(entity as Record<string, unknown>);
    }
    return out;
}

/**
 * Structured `meta` profile for the memory panel: the summary line plus the
 * PROFILE_FIELDS lists of the first entity that carries any.
 */
export function profileEntity(data: ReadSyncData): ProfileEntity | undefined {
    const answer = typeof data?.answer === 'string' ? data.answer : '';
    const { rest, sections } = parseProfileSections(answer.replace(/<\/?user-info>/g, ''));
    const fields: ProfileEntity['fields'] = [];
    let description = '';
    for (const entity of intermediateEntities(data)) {
        for (const [key, label] of PROFILE_FIELDS) {
            const values = Array.isArray(entity[key]) ? (entity[key] as unknown[]).filter(Boolean) : [];
            if (values.length > 0) fields.push({ key, label, items: values.map(profileItem) });
        }
        if (!description && typeof entity.description === 'string') description = entity.description.trim();
        if (fields.length > 0) break;
    }
    // Fields only present as `<key>...</key>` sections of the answer text.
    for (const [key, label] of PROFILE_FIELDS) {
        if (!fields.some((field) => field.key === key) && sections[key]?.length) {
            fields.push({ key, label, items: sections[key]! });
        }
    }
    fields.sort((a, b) => PROFILE_FIELDS.findIndex(([key]) => key === a.key) - PROFILE_FIELDS.findIndex(([key]) => key === b.key));
    return rest || fields.length > 0 || description ? { summary: rest, fields, description } : undefined;
}

/**
 * Turn a `meta` read/sync payload into the text injected at session start.
 *
 * `data.answer` is a `<user-info>` block that is empty until the server has
 * built a profile; the entity's `description` and structured fields live in
 * `intermediate_outputs[].data`, so both are read.
 */
export function renderProfile(data: ReadSyncData): string {
    const lines: string[] = [];
    const answer = typeof data?.answer === 'string' ? data.answer : '';
    const info = answer.replace(/<\/?user-info>/g, '').trim();
    if (info) lines.push(info);
    for (const entity of intermediateEntities(data)) {
        for (const [key, label] of PROFILE_FIELDS) {
            const values = Array.isArray(entity[key]) ? (entity[key] as unknown[]).filter(Boolean) : [];
            if (values.length > 0) lines.push(`${label}:\n${values.map((value) => `- ${profileItem(value)}`).join('\n')}`);
        }
        const description = typeof entity.description === 'string' ? entity.description.trim() : '';
        if (description) {
            lines.push(`Description:\n${description.split('；').map((line) => `- ${line.trim()}`).filter((line) => line !== '-').join('\n')}`);
        }
    }
    return lines.join('\n\n');
}
