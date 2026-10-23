/**
 * `memory_search` tool registration, kept in sync with volatile settings.
 *
 * @module dsh-memoryskills/features/tools
 */
import { NAME, TOOL_SEARCH_SWITCHES, type SearchSwitch } from '../constants.js';
import type { ConfigSnapshot } from '../config.js';
import { defineTool, type Disposable, type PluginContext, type ToolsService } from '@redbear/dsh-memory-core';
import type { PortalClient } from '../services/portal-client.js';

export interface ToolsDeps {
    ctx: PluginContext;
    getConfig(): ConfigSnapshot;
    client: PortalClient;
}

/** Controller returned to the plugin entry. */
export interface ToolsController {
    /** Re-register the tool when its settings changed. */
    sync(): void;
    /** Whether `memory_search` is currently registered. */
    isSearchRegistered(): boolean;
}

/** Tool arguments the model may pass. */
interface MemorySearchArgs extends Record<string, unknown> {
    query: string;
    search_switch?: string;
}

const MODE_HELP: Record<SearchSwitch, string> = {
    express: 'express: fast keyword lookup for a single named fact.',
    quick: 'quick: keyword + vector hybrid, for paraphrased or fuzzy questions.',
    normal: 'normal: decomposes the question and summarizes, for questions spanning several facts (slow).',
    deep: 'deep: normal plus cross-checking, for multi-hop or conflicting memories (slowest).',
};

/** Register and re-register `memory_search` as settings change. */
export function installTools({ ctx, getConfig, client }: ToolsDeps): ToolsController {
    let toolOff: Disposable | undefined;
    let toolKey: string | undefined;
    let toolsCtx: (PluginContext & { tools: ToolsService }) | undefined;
    let searchRegistered = false;

    function sync(): void {
        const cfg = getConfig();
        const switches = TOOL_SEARCH_SWITCHES.filter((mode) => cfg.toolSearchSwitches.includes(mode));
        if (switches.length === 0) switches.push('express');
        const fallback: SearchSwitch = switches.includes(cfg.searchSwitch as SearchSwitch)
            ? (cfg.searchSwitch as SearchSwitch)
            : (switches[0] ?? 'express');
        const key = JSON.stringify([cfg.tool, switches, fallback, cfg.recall]);
        if (key === toolKey) return;
        toolKey = key;
        toolOff?.();
        toolOff = undefined;
        searchRegistered = false;
        if (!cfg.tool || !toolsCtx) return;
        toolOff = toolsCtx.tools.register(defineTool<MemorySearchArgs, { answer: string }>({
            name: 'memory_search',
            description: 'Search the user\'s long-term memory (MemorySkills) for facts, preferences and past events. '
                + (cfg.recall
                    ? `Relevant memory is already recalled automatically at the start of each turn (mode "${cfg.searchSwitch}"); `
                        + 'call this only for a different or more specific question, or to retry with a deeper mode.'
                    : 'Memory is NOT recalled automatically per turn (only a profile summary may be loaded at session start). '
                        + 'Call this whenever the answer depends on who the user is or what they told you before — '
                        + 'their preferences, history, people, plans, or "remember"/"last time" references. '
                        + 'Do not call it for tasks that need no personal context.'),
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'A specific natural-language question about the user.' },
                    search_switch: {
                        type: 'string',
                        description: `Retrieval mode; pick the cheapest that fits. ${switches.map((mode) => MODE_HELP[mode]).join(' ')} Omit to use "${fallback}".`,
                        enum: switches,
                    },
                },
                required: ['query'],
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: { answer: { type: 'string' } },
                    required: ['answer'],
                },
                render: (_args, value) => [{ type: 'text', text: value.answer || '(no relevant memory found)' }],
            },
            isConcurrencySafe: () => true,
            async execute(args, exec) {
                const query = String(args.query);
                const requested = args.search_switch as SearchSwitch | undefined;
                const searchSwitch: SearchSwitch = requested && switches.includes(requested) ? requested : fallback;
                const slow = searchSwitch === 'normal' || searchSwitch === 'deep';
                const now = getConfig();
                try {
                    return {
                        answer: await client.readMemory(query, exec.signal, {
                            searchSwitch,
                            timeoutMs: slow ? now.slowSearchTimeoutMs : now.toolTimeoutMs,
                        }),
                    };
                } catch (error) {
                    // A slow mode that times out or is shed by the Portal's slow-read
                    // limiter (429) degrades to `quick` instead of failing the call.
                    const status = error instanceof Error && 'status' in error ? Number((error as { status?: unknown }).status) : undefined;
                    const shed = (error instanceof Error && error.name === 'TimeoutError') || status === 429;
                    if (!slow || exec.signal?.aborted || !shed) throw error;
                    ctx.logger.warn(`[${NAME}] memory_search ${searchSwitch} ${status === 429 ? 'shed (429)' : 'timed out'}; falling back to quick`);
                    const answer = await client.readMemory(query, exec.signal, { searchSwitch: 'quick', timeoutMs: now.toolTimeoutMs });
                    return { answer: `[mode "${searchSwitch}" unavailable; results below are from "quick"]\n${answer}` };
                }
            },
        }));
        searchRegistered = true;
    }

    sync();
    ctx.inject(['tools'], (tctx) => {
        toolsCtx = tctx;
        toolKey = undefined;
        sync();
        tctx.effect(() => () => {
            toolsCtx = undefined;
            toolOff = undefined;
            toolKey = undefined;
            searchRegistered = false;
        }, `${NAME}: release tools`);
    });

    return {
        sync,
        isSearchRegistered: () => searchRegistered,
    };
}
