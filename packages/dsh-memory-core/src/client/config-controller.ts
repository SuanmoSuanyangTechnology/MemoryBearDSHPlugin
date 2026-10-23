/**
 * Generic staged config form over the dsh `configForms` scope and the
 * credential status. Plugins supply their field definitions and field order.
 *
 * @module dsh-memory-core/client/config-controller
 */
import {
    formatField,
    parseField,
    sameValue,
    type FieldNameOf,
    type FieldSpecMap,
    type FieldState,
    type FieldStatesOf,
    type FieldValueOf,
} from './form-schema.js';
import type {
    ConfigMutation,
    ConfigScope,
    CredentialView,
    RemoteService,
} from './types.js';

export type Notice = { kind: 'ok' } | { kind: 'error'; reason: string };

export interface ConfigPageSnapshot<S extends FieldSpecMap> {
    available: boolean;
    loading: boolean;
    writable: boolean;
    fields: FieldStatesOf<S>;
    keyDraft: string;
    keyInvalid: boolean;
    credential: CredentialView;
    dirty: boolean;
    invalid: boolean;
    saving: boolean;
    notice: Notice | null;
}

/** The subset of the client context a config controller needs. */
export interface ConfigControllerContext {
    readonly remote: RemoteService;
}

export interface ConfigControllerOptions {
    /** Credential reference used when the entry names none. */
    defaultKeyRef: string;
    /** Optional API-key draft validation (e.g. `sk-mem-` prefix). */
    isKeyInvalid?: (key: string) => boolean;
}

interface Draft {
    text: unknown;
    clear: boolean;
}

export class ConfigController<S extends FieldSpecMap> {
    private readonly ctx: ConfigControllerContext;
    private readonly scope: ConfigScope;
    private readonly specs: S;
    private readonly fieldNames: ReadonlyArray<FieldNameOf<S>>;
    private readonly options: ConfigControllerOptions;
    /** field -> staged draft */
    private readonly drafts = new Map<FieldNameOf<S>, Draft>();
    private readonly listeners = new Set<() => void>();
    private keyDraft = '';
    private credential: CredentialView = { ref: '', configured: false, writable: true };
    private saving = false;
    private notice: Notice | null = null;
    private snapshot: ConfigPageSnapshot<S>;
    private unsubscribe: (() => void) | undefined;

    constructor(
        ctx: ConfigControllerContext,
        scope: ConfigScope,
        specs: S,
        fieldNames: ReadonlyArray<FieldNameOf<S>>,
        options: ConfigControllerOptions,
    ) {
        this.ctx = ctx;
        this.scope = scope;
        this.specs = specs;
        this.fieldNames = fieldNames;
        this.options = options;
        this.snapshot = this.project();
        this.unsubscribe = scope.subscribe(() => {
            void this.readCredential();
            this.publish();
        });
        void this.readCredential();
    }

    /** Stop following the shared form (the configForms provider owns it). */
    dispose(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
    }

    getSnapshot = (): ConfigPageSnapshot<S> => this.snapshot;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    private publish(): void {
        this.snapshot = this.project();
        for (const listener of this.listeners) listener();
    }

    private ref(): string {
        const declared = this.scope.getSnapshot().value?.apiKeyEnv;
        return typeof declared === 'string' && declared.length > 0 ? declared : this.options.defaultKeyRef;
    }

    private stored(field: FieldNameOf<S>): boolean {
        const user = this.scope.getSnapshot().user;
        return user !== undefined && typeof user === 'object' && Object.prototype.hasOwnProperty.call(user, field);
    }

    /** One control's state: shown value, override badge, validity. */
    private field<N extends FieldNameOf<S>>(field: N): FieldState<FieldValueOf<S, N>> {
        const snapshot = this.scope.getSnapshot();
        const draft = this.drafts.get(field);
        if (draft === undefined) {
            return { text: formatField(this.specs, field, snapshot.value?.[field]), overridden: this.stored(field), invalid: false };
        }
        if (draft.clear) {
            return { text: formatField(this.specs, field, snapshot.base?.[field]), overridden: false, invalid: false };
        }
        const write = parseField(this.specs, field, draft.text);
        return { text: draft.text as FieldValueOf<S, N>, overridden: write?.kind === 'set', invalid: write === undefined };
    }

    private project(): ConfigPageSnapshot<S> {
        const snapshot = this.scope.getSnapshot();
        const fields = Object.fromEntries(
            this.fieldNames.map((field) => [field, this.field(field)]),
        ) as FieldStatesOf<S>;
        const key = this.keyDraft.trim();
        const keyInvalid = this.options.isKeyInvalid?.(key) ?? false;
        const invalid = keyInvalid || (Object.values(fields) as Array<FieldState<unknown>>).some((state) => state.invalid);
        const dirty = this.drafts.size > 0 || key !== '';
        return {
            available: snapshot.status === 'ready',
            loading: snapshot.status === 'loading',
            writable: snapshot.writable,
            fields,
            keyDraft: this.keyDraft,
            keyInvalid,
            credential: { ...this.credential },
            dirty,
            invalid,
            saving: this.saving,
            notice: this.notice,
        };
    }

    private async readCredential(): Promise<void> {
        const ref = this.ref();
        if (ref !== this.credential.ref) this.credential = { ref, configured: false, writable: true };
        let response;
        try {
            response = await this.ctx.remote.credentials.describe([ref]);
        } catch {
            return;
        }
        if (!response?.ok || ref !== this.ref()) return;
        const view = response.value?.[ref];
        this.credential = {
            ref,
            configured: view?.configured ?? false,
            writable: view?.writable ?? true,
            source: view?.source,
        };
        this.publish();
    }

    /** Re-read the credential view when the Host announces a change. */
    refreshCredential(ref: string): void {
        if (ref === this.credential.ref) void this.readCredential();
    }

    edit<N extends FieldNameOf<S>>(field: N, text: FieldValueOf<S, N>): void {
        this.drafts.set(field, { text, clear: false });
        this.notice = null;
        this.publish();
    }

    reset(field: FieldNameOf<S>): void {
        this.drafts.set(field, { text: '', clear: true });
        this.notice = null;
        this.publish();
    }

    editKey(text: string): void {
        this.keyDraft = text;
        this.notice = null;
        this.publish();
    }

    discard(): void {
        if (this.drafts.size === 0 && this.keyDraft === '' && this.notice === null) return;
        this.drafts.clear();
        this.keyDraft = '';
        this.notice = null;
        this.publish();
    }

    /** Write staged fields in one mutation and the key through credentials, then read back. */
    async save(): Promise<void> {
        const snapshot = this.scope.getSnapshot();
        if (this.saving || snapshot.status !== 'ready' || !snapshot.writable || this.snapshot.invalid) return;
        const operations: ConfigMutation[] = [];
        const expected = new Map<FieldNameOf<S>, { clear?: boolean; value?: unknown }>();
        for (const [field, draft] of this.drafts) {
            const write = draft.clear ? ({ kind: 'clear' } as const) : parseField(this.specs, field, draft.text);
            if (write === undefined) return;
            if (write.kind === 'clear') {
                if (this.stored(field)) {
                    operations.push({ op: 'unset', path: [field] });
                    expected.set(field, { clear: true });
                }
            } else if (!sameValue(write.value, snapshot.value?.[field]) || !this.stored(field)) {
                operations.push({ op: 'set', path: [field], value: write.value });
                expected.set(field, { value: write.value });
            }
        }
        const key = this.keyDraft.trim();
        this.saving = true;
        this.notice = null;
        this.publish();
        const failures: string[] = [];
        if (key !== '') {
            try {
                const response = await this.ctx.remote.credentials.set(this.ref(), key);
                if (response && response.ok === false) failures.push(response.error?.message ?? 'credential-rejected');
            } catch (error) {
                failures.push(String(error instanceof Error ? error.message : error));
            }
            await this.readCredential();
        }
        if (operations.length > 0) {
            try {
                await this.scope.mutate(operations);
            } catch (error) {
                failures.push(String(error instanceof Error ? error.message : error));
            }
            // The Host is the authority: check what actually landed.
            const user = this.scope.getSnapshot().user ?? {};
            for (const [field, want] of expected) {
                const has = Object.prototype.hasOwnProperty.call(user, field);
                if (want.clear ? has : !has || !sameValue(user[field], want.value)) failures.push(field);
            }
        }
        this.saving = false;
        if (failures.length === 0) {
            this.drafts.clear();
            this.keyDraft = '';
            this.notice = { kind: 'ok' };
        } else {
            this.notice = { kind: 'error', reason: failures.join(', ') };
        }
        this.publish();
    }
}
