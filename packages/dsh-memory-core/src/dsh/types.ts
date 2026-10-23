/**
 * Minimal structural types for the parts of the Cordis/dsh host the memory
 * plugins touch. Shared by both plugins so host-contract changes land once.
 *
 * @module dsh-memory-core/dsh/types
 */

/** Disposer returned by `ctx.on`/`ctx.effect` and service registrations. */
export type Disposable = () => void;

/** Host logger (console-backed in dsh). */
export interface Logger {
    info(message: string): void;
    warn(message: string): void;
    error(message: unknown): void;
}

/** `source` of a message produced by a plugin. */
export interface MessageSource {
    kind?: string;
    plugin?: string;
    form?: string;
    sections?: Array<{ name: string; text: string }>;
}

/** An attachment reference carried by a dsh image/file content block. */
export interface AttachmentRef {
    attachmentId: string;
    name?: string;
    mediaType?: string;
    bytes: number;
    width?: number;
    height?: number;
    [key: string]: unknown;
}

/** An image/file content block. */
export interface AttachmentBlock {
    type: 'image' | 'file';
    attachment: AttachmentRef;
}

/** Which user attachments are written to the backend. */
export type AttachmentMode = 'none' | 'images' | 'all';

/** One content block of a dsh message. */
export type ContentBlock =
    | { type: 'text'; text: string }
    | AttachmentBlock
    | { type: string; [key: string]: unknown };

/** A dsh conversation message (only the fields the plugins read). */
export interface Message {
    id?: string;
    role?: string;
    source?: MessageSource;
    content?: ContentBlock[];
    [key: string]: unknown;
}

/** One entry of a session's durable event log. */
export interface SessionEvent {
    type: string;
    data?: unknown;
    time?: number;
}

/** dsh session handle. */
export interface Session {
    id: string | number;
    header?: { origin?: string };
    seq?: number;
    eventAt(seq: number): SessionEvent | undefined;
}

/** Result of the `agent/pre-step` waterfall. */
export interface PreStepDecision {
    kind: string;
    messages: Message[];
    [key: string]: unknown;
}

/** `agent/pre-step` event payload. */
export interface PreStepEvent {
    agent: { session: Session };
    step: number;
    signal: AbortSignal;
}

/** Host events the plugins subscribe to. */
export interface PluginEvents {
    'agent/pre-step': (event: PreStepEvent, next: () => Promise<PreStepDecision>) => Promise<PreStepDecision>;
    'session/event': (session: Session, event: SessionEvent) => void;
    'session/disposed': (session: Session) => void;
    'loader/volatile-update': () => void;
}

/** dsh credential store (launch env, `.credentials.yaml`, `.env`). */
export interface CredentialsService {
    resolve(ref: string): Promise<{ value?: string } | undefined>;
}

/** Host attachment store. */
export interface AttachmentsService {
    readImage(ref: AttachmentRef): Promise<{ data: Uint8Array }>;
    readFileStream(ref: AttachmentRef): AsyncIterable<Uint8Array>;
}

/** Tool execution context handed to `execute`. */
export interface ToolExecuteContext {
    signal?: AbortSignal;
}

/** Plain tool definition accepted by the host `tools` registry. */
export interface ToolRegistration {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    output?: {
        schema: Record<string, unknown>;
        render(args: any, value: any): unknown;
    };
    isConcurrencySafe?: () => boolean;
    execute(args: Record<string, unknown>, exec: ToolExecuteContext): Promise<unknown>;
}

/** Host `tools` service. */
export interface ToolsService {
    register(definition: ToolRegistration): Disposable;
}

/** One HTTP route registered on the shared dsh API channel. */
export interface ConnectionRoute {
    path: string;
    methods: string[];
    requestBody: 'buffered';
    fetch(request: Request): Promise<Response>;
}

/** Host `connection` service (web/desktop only). */
export interface ConnectionService {
    fetch: { register(route: ConnectionRoute): Disposable };
}

/** Services that can be requested through `ctx.inject`. */
export interface InjectableServices {
    tools: ToolsService;
    connection: ConnectionService;
}

/** Cordis plugin context as seen by the plugins. */
export interface PluginContext {
    logger: Logger;
    on<K extends keyof PluginEvents>(event: K, handler: PluginEvents[K]): Disposable;
    effect(effect: () => Disposable | void, label: string): void;
    get(service: 'credentials'): CredentialsService | undefined;
    get(service: 'attachments'): AttachmentsService | undefined;
    get(service: string): unknown;
    inject<K extends keyof InjectableServices>(
        deps: readonly K[],
        callback: (context: PluginContext & Pick<InjectableServices, K>) => void,
    ): void;
}

/** Whether the session belongs to a subagent. */
export function isSubagentSession(session: Session | undefined): boolean {
    return session?.header?.origin === 'subagent';
}
