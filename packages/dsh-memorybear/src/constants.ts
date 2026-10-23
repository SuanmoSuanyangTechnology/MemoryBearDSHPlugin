/**
 * Constants shared by the Host half, the browser half and the tests.
 *
 * @module dsh-memorybear/constants
 */

/** Cordis plugin name; also the `source.kind` of injected messages. */
export const NAME = 'memorybear-memory';

/** Settings namespace edited by the Plugins page; since dsh 0.2 the profile entry id. */
export const SETTINGS_NAMESPACE = NAME;

/** Required services; `tools` and `connection` are optional (`ctx.inject`). */
export const INJECT = ['agents', 'sessions'] as const;

/** Write modes: every turn, every N turns, or once the session goes idle. */
export const WRITE_MODES = ['turn', 'batch', 'idle'] as const;
export type WriteMode = (typeof WRITE_MODES)[number];

/** Preference engine use: per-turn injection, model-called tool, or off. */
export const PREFERENCE_MODES = ['auto', 'tool', 'off'] as const;
export type PreferenceMode = (typeof PREFERENCE_MODES)[number];

/** Which user attachments are written to MemoryBear. */
export const ATTACHMENT_MODES = ['none', 'images', 'all'] as const;
export type AttachmentMode = (typeof ATTACHMENT_MODES)[number];

/** Modes the model may choose for memory_search (server-side aliases). */
export const TOOL_SEARCH_SWITCHES = ['express', 'quick', 'normal', 'deep'] as const;
export type ToolSearchSwitch = (typeof TOOL_SEARCH_SWITCHES)[number];

/** Memory panel data route on dsh's shared API channel (full path, `/api` included). */
export const INSIGHTS_PATH = '/api/memorybear/insights';

/** Section name that marks the injected profile message in session history. */
export const PROFILE_SECTION = `${NAME}/profile`;

/** Section name that marks injected preference messages. */
export const PREFERENCE_SECTION = `${NAME}/preferences`;

/** Server-side cap on `current_user_message`; stay well under it. */
export const PREFERENCE_MESSAGE_MAX_CHARS = 4_000;

/** Per-message cap on preference routing context. */
export const PREFERENCE_CONTEXT_MAX_CHARS = 1_000;

/** Core entities kept per community card. */
export const COMMUNITY_ENTITIES_MAX = 12;

/** Bounded cache of uploaded `attachmentId -> file_id`. */
export const UPLOAD_CACHE_MAX = 500;

/** File extension for a dsh image media type. */
export const IMAGE_EXT: Readonly<Record<string, string>> = Object.freeze({
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
});
