/**
 * Notify-only update check: read the npm `latest` tag, log a notice and expose
 * the result to the configuration page. It never installs or changes files.
 *
 * @module dsh-memoryskills/features/update
 */
import { createRequire } from 'node:module';
import { createUpdateChecker, type PluginContext, type UpdateStatus } from '@redbearai/dsh-memory-core';
import type { ConfigSnapshot } from '../config.js';
import { NAME, UPDATE_PATH } from '../constants.js';

const pkg = createRequire(import.meta.url)('@redbearai/dsh-memoryskills/package.json') as { version: string };

export interface UpdateDeps {
    ctx: PluginContext;
    getConfig(): ConfigSnapshot;
}

export interface UpdateController {
    /** Re-run the cached check (no-op when disabled or fresh). */
    check(): void;
}

/** Register the update checker, its log notice and the read-only route. */
export function installUpdateCheck({ ctx, getConfig }: UpdateDeps): UpdateController {
    const checker = createUpdateChecker({
        packageName: '@redbearai/dsh-memoryskills',
        currentVersion: pkg.version,
        isEnabled: () => getConfig().updateCheck,
    });
    let announced: string | undefined;

    const check = (): void => {
        void checker.check().then((status: UpdateStatus) => {
            if (!status.available || status.latest === undefined || status.spec === undefined) return;
            if (announced === status.latest) return;
            announced = status.latest;
            ctx.logger.info(`[${NAME}] update available: ${status.current} -> ${status.latest}; uninstall this plugin and install ${status.spec}`);
        });
    };

    check();

    ctx.inject(['connection'], (connectionCtx) => {
        connectionCtx.effect(() => connectionCtx.connection.fetch.register({
            path: UPDATE_PATH,
            methods: ['GET'],
            requestBody: 'buffered',
            fetch: async (): Promise<Response> => new Response(JSON.stringify(await checker.check()), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            }),
        }), `${NAME}: update route`);
    });

    return { check };
}
