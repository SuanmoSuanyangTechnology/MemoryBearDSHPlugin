/**
 * Memory panel data: the `GET /api/memorybear/insights` route registered on
 * dsh's shared API channel.
 *
 * Optional `connection` (web/desktop hosts only; headless has none). The route
 * sits on the shared channel, so Connection applies its own browser-session
 * trust and authentication before `fetch` runs; the API key stays on the Host
 * and never reaches the browser.
 *
 * @module dsh-memorybear/features/panel
 */
import { INSIGHTS_PATH, NAME } from '../constants.js';
import { isTimeZone, missingConfig, type ConfigSnapshot } from '../config.js';
import type { PluginContext } from '@redbear/dsh-memory-core';
import type { Insights, MemoryBearClient } from '../services/memorybear-client.js';

export interface PanelDeps {
    ctx: PluginContext;
    getConfig(): ConfigSnapshot;
    client: MemoryBearClient;
}

/** Register the insights route while the `connection` service is present. */
export function installPanel({ ctx, getConfig, client }: PanelDeps): void {
    ctx.inject(['connection'], (connectionCtx) => {
        connectionCtx.effect(() => connectionCtx.connection.fetch.register({
            path: INSIGHTS_PATH,
            methods: ['GET'],
            requestBody: 'buffered',
            fetch: async (request: Request): Promise<Response> => {
                const cfg = getConfig();
                const json = (status: number, body: Record<string, unknown>): Response => new Response(JSON.stringify(body), {
                    status,
                    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
                });
                if (!cfg.panel) return json(404, { error: 'panel disabled' });
                const missing = missingConfig(cfg);
                if (missing.length > 0) return json(200, { configured: false, missing });
                const requested = new URL(request.url).searchParams.get('tz') ?? '';
                const timeZone = isTimeZone(requested) ? requested : Intl.DateTimeFormat().resolvedOptions().timeZone;
                const insights: Insights = await client.insights(timeZone);
                return json(200, { configured: true, timeZone, ...insights });
            },
        }), `${NAME}: insights route`);
    });
}
