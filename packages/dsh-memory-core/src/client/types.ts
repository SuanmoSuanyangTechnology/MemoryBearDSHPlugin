/**
 * Structural types for the dsh web client services the memory config pages
 * use. React types stay in each plugin's page components.
 *
 * @module dsh-memory-core/client/types
 */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export interface PageProps {
    t: Translate;
    /** `page` renders the form, `summary` renders one line for the Plugins index. */
    view?: string;
}

/** A component the dsh slot registry can mount. */
export type PageComponent = (props: PageProps) => unknown;

export interface CredentialView {
    /** Credential reference the view describes. */
    ref: string;
    configured: boolean;
    writable: boolean;
    source?: string;
}

export interface CredentialResponse {
    ok?: boolean;
    value?: Record<string, CredentialView>;
    error?: { message?: string };
}

export interface ConfigScopeSnapshot {
    status: string;
    writable: boolean;
    value?: Record<string, unknown>;
    base?: Record<string, unknown>;
    user?: Record<string, unknown>;
    revision?: number;
    mode?: string;
}

export type ConfigMutation =
    | { op: 'set'; path: [string]; value: unknown }
    | { op: 'unset'; path: [string] };

export interface ConfigScope {
    getSnapshot(): ConfigScopeSnapshot;
    subscribe(listener: () => void): () => void;
    mutate(operations: ConfigMutation[]): Promise<void>;
}

export interface ConfigFormsService {
    get(namespace: string): ConfigScope;
    whileServed(namespaces: string[], register: () => void): () => void;
}

export interface SlotOptions {
    name: string;
    key: string;
    locale: string;
    [key: string]: unknown;
}

export interface SlotsService {
    inject(name: string, callback: () => void): () => void;
    register(options: SlotOptions, component: PageComponent): () => void;
}

export interface LocaleService {
    register(namespace: string, dictionaries: Record<string, Record<string, string>>): () => void;
    bind(namespace: string): Translate;
}

export interface RemoteService {
    $on(event: string, callback: (...args: any[]) => void): () => void;
    credentials: {
        describe(refs: string[]): Promise<CredentialResponse>;
        set(ref: string, value: string): Promise<CredentialResponse>;
    };
}

/** Context services requested through `ctx.inject` by a client plugin. */
export type InjectableClientServices = Record<string, unknown>;

/** Cordis browser context as seen by the memory config pages. */
export interface ClientContext<Services extends InjectableClientServices = Record<string, never>> {
    effect(effect: () => void | (() => void), label: string): void;
    inject<K extends Extract<keyof Services, string>>(
        deps: readonly K[],
        callback: (context: ClientContext<Services> & Pick<Services, K>) => void,
    ): void;
    locale: LocaleService;
    remote: RemoteService;
    configForms: ConfigFormsService;
    slots: SlotsService;
}
