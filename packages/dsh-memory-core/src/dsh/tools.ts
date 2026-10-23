/**
 * Minimal tool definition helper for the host `tools` registry.
 *
 * The plugins deliberately do not import `@deepseek-ai/dsh-tools`: shipping it
 * as a dependency installed a second copy in the profile and broke the host
 * tool scheduler. The registry only needs a plain object with JSON-schema
 * `parameters` and `output.schema`.
 *
 * @module dsh-memory-core/dsh/tools
 */
import type { ToolExecuteContext, ToolRegistration } from './types.js';

/** Tool definition before it is adapted to the host registry. */
export interface ToolOptions<Args extends Record<string, unknown>, Result> {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    output: {
        schema: Record<string, unknown>;
        render(args: Args, value: Result): unknown;
    };
    isConcurrencySafe?: () => boolean;
    execute(args: Args, exec: ToolExecuteContext): Promise<Result>;
}

/**
 * Build a host tool definition and validate the required string argument.
 *
 * @param options - name, description, JSON-schema parameters, output renderer and execute.
 * @param requiredArg - string argument that must be present and non-empty (default `query`).
 */
export function defineTool<Args extends Record<string, unknown>, Result>(
    options: ToolOptions<Args, Result>,
    requiredArg = 'query',
): ToolRegistration {
    const userExecute = options.execute;
    return {
        ...options,
        async execute(args: Record<string, unknown>, exec: ToolExecuteContext): Promise<unknown> {
            const value = args[requiredArg];
            if (typeof value !== 'string' || !value.trim()) {
                throw new TypeError(`${options.name}: \`${requiredArg}\` must be a non-empty string`);
            }
            return userExecute(args as Args, exec);
        },
    } as ToolRegistration;
}
