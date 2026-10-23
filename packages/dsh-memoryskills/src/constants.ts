/**
 * Constants shared by the Host half, the browser half and the tests.
 *
 * @module dsh-memoryskills/constants
 */

/** Cordis plugin name; also the `source.kind` of injected messages. */
export const NAME = 'memoryskills-memory';

/** Required Cordis services. `tools` is optional and picked up via `ctx.inject`. */
export const INJECT = ['agents', 'sessions'] as const;

/** Write modes: every turn, every N turns, or once the session goes idle. */
export const WRITE_MODES = ['turn', 'batch', 'idle'] as const;
export type WriteMode = (typeof WRITE_MODES)[number];

/** `read_memory` modes the model may pick in memory_search (`meta` is profile-only). */
export const TOOL_SEARCH_SWITCHES = ['express', 'quick', 'normal', 'deep'] as const;
export type SearchSwitch = (typeof TOOL_SEARCH_SWITCHES)[number];

/** Default production Portal. */
export const DEFAULT_PORTAL = 'https://memoryskills.redbearai.com';

/** MemorySkills rejects longer write messages. */
export const WRITE_MAX_CHARS = 8_000;

/** Section name that marks the injected profile message. */
export const PROFILE_SECTION = `${NAME}/profile`;

/** Plugin version reported to the MCP server. */
export const CLIENT_VERSION = '0.1.0';
