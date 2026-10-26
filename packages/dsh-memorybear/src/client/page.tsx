/**
 * The configuration page shown on this bundle's page in dsh web's Plugins panel.
 *
 * @module dsh-memorybear/client/page
 */
import { useEffect, useSyncExternalStore, type ChangeEvent, type ReactNode } from 'react';
import { fill, type ConfigController, type PageComponent, type PageProps } from '@redbearai/dsh-memory-core/client';
import { Checkbox, Field, SwitchField, TextInput } from './components/form.js';
import { FIELDS, SEARCH_MODES } from './form-schema.js';

function credentialHint(s: ReturnType<ConfigController<typeof FIELDS>['getSnapshot']>, t: PageProps['t']): string {
    const cred = s.credential;
    const keyLocked = cred.configured && !cred.writable;
    if (keyLocked) return fill(t('apiKeyEnvLocked'), { ref: cred.ref });
    return [
        cred.configured ? fill(t('apiKeySet'), { source: cred.source ?? '?' }) : t('apiKeyUnset'),
        fill(t('apiKeyHint'), { ref: cred.ref }),
    ].join(' ');
}

/** Build the page component for one controller instance. */
export function makePage(controller: ConfigController<typeof FIELDS>): PageComponent {
    return function MemoryBearConfig({ t, view }: PageProps): ReactNode {
        const s = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
        // Leaving the page drops staged edits, like the official pages.
        useEffect(() => () => controller.discard(), []);
        if (view === 'summary') return t('summary');
        if (!s.available) return <p className="mb-hint">{s.loading ? t('loading') : t('unavailable')}</p>;

        const disabled = !s.writable || s.saving;
        const f = s.fields;
        const mode = f.writeMode.text || 'turn';
        const cred = s.credential;
        const keyLocked = cred.configured && !cred.writable;
        const preferenceMode = f.preferenceMode.text || 'auto';
        const attachmentMode = f.attachments.text || 'images';
        return (
            <div className="mb-cfg">
                {!s.writable ? <p className="mb-hint">{t('readOnly')}</p> : null}
                <section className="mb-group">
                    <h4 className="mb-group-title">{t('connection')}</h4>
                    <Field
                        id="mb-base-url"
                        label={t('baseURL')}
                        hint={t('baseURLHint')}
                        state={f.baseURL}
                        disabled={disabled}
                        t={t}
                        onReset={() => controller.reset('baseURL')}
                    >
                        <TextInput id="mb-base-url" state={f.baseURL} disabled={disabled} onEdit={(value) => controller.edit('baseURL', value)} placeholder="https://<host>/v1" />
                    </Field>
                    <Field
                        id="mb-end-user"
                        label={t('endUserId')}
                        hint={t('endUserIdHint')}
                        state={f.endUserId}
                        disabled={disabled}
                        t={t}
                        onReset={() => controller.reset('endUserId')}
                    >
                        <TextInput id="mb-end-user" state={f.endUserId} disabled={disabled} onEdit={(value) => controller.edit('endUserId', value)} />
                    </Field>
                    <Field id="mb-api-key" label={t('apiKey')} hint={credentialHint(s, t)} disabled={disabled} t={t}>
                        <TextInput
                            id="mb-api-key"
                            type="password"
                            state={{ text: s.keyDraft, overridden: false, invalid: false }}
                            disabled={disabled || keyLocked}
                            onEdit={(value) => controller.editKey(value)}
                            placeholder={cred.configured ? '••••••••' : ''}
                        />
                    </Field>
                </section>
                <section className="mb-group">
                    <h4 className="mb-group-title">{t('recallGroup')}</h4>
                    <SwitchField id="mb-profile" field="profile" label={t('profile')} hint={t('profileHint')} fields={f} disabled={disabled} t={t} controller={controller} />
                    <SwitchField id="mb-recall" field="recall" label={t('recall')} hint={t('recallHint')} fields={f} disabled={disabled} t={t} controller={controller} />
                    <Field
                        id="mb-search-switch"
                        label={t('searchSwitch')}
                        hint={t('searchSwitchHint')}
                        state={f.searchSwitch}
                        disabled={disabled}
                        t={t}
                        onReset={() => controller.reset('searchSwitch')}
                    >
                        <select
                            id="mb-search-switch"
                            className="mb-input"
                            value={f.searchSwitch.text || 'express'}
                            disabled={disabled}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) => controller.edit('searchSwitch', event.target.value)}
                        >
                            {SEARCH_MODES.map((name) => <option key={name} value={name}>{t(`search_${name}`)}</option>)}
                        </select>
                    </Field>
                    <Field
                        id="mb-tool-switches"
                        label={t('toolSearchSwitches')}
                        hint={t('toolSearchSwitchesHint')}
                        state={f.toolSearchSwitches}
                        disabled={disabled}
                        t={t}
                        error={t('pickOne')}
                        onReset={() => controller.reset('toolSearchSwitches')}
                    >
                        <div className="mb-checks" id="mb-tool-switches">
                            {SEARCH_MODES.map((name) => (
                                <Checkbox
                                    key={name}
                                    id={`mb-tool-${name}`}
                                    label={t(`search_${name}`)}
                                    checked={f.toolSearchSwitches.text.includes(name)}
                                    disabled={disabled}
                                    onEdit={(checked) => controller.edit('toolSearchSwitches', checked
                                        ? SEARCH_MODES.filter((item) => item === name || f.toolSearchSwitches.text.includes(item))
                                        : f.toolSearchSwitches.text.filter((item) => item !== name))}
                                />
                            ))}
                        </div>
                    </Field>
                </section>
                <section className="mb-group">
                    <h4 className="mb-group-title">{t('writing')}</h4>
                    <SwitchField id="mb-write" field="write" label={t('write')} hint={t('writeHint')} fields={f} disabled={disabled} t={t} controller={controller} />
                    {!f.write.text ? null : (
                        <Field
                            id="mb-write-mode"
                            label={t('writeMode')}
                            hint={t(`modeHint_${mode}`)}
                            state={f.writeMode}
                            disabled={disabled}
                            t={t}
                            onReset={() => controller.reset('writeMode')}
                        >
                            <select
                                id="mb-write-mode"
                                className="mb-input"
                                value={mode}
                                disabled={disabled}
                                onChange={(event: ChangeEvent<HTMLSelectElement>) => controller.edit('writeMode', event.target.value)}
                            >
                                {FIELDS.writeMode.options.map((name) => <option key={name} value={name}>{t(`mode_${name}`)}</option>)}
                            </select>
                        </Field>
                    )}
                    {f.write.text && mode === 'batch' ? (
                        <Field
                            id="mb-every"
                            label={t('writeEveryTurns')}
                            state={f.writeEveryTurns}
                            disabled={disabled}
                            t={t}
                            error={fill(t('invalidInt'), { min: 1 })}
                            onReset={() => controller.reset('writeEveryTurns')}
                        >
                            <TextInput id="mb-every" state={f.writeEveryTurns} disabled={disabled} onEdit={(value) => controller.edit('writeEveryTurns', value)} inputMode="numeric" />
                        </Field>
                    ) : null}
                    {f.write.text && mode !== 'turn' ? (
                        <Field
                            id="mb-idle"
                            label={t('writeIdleMinutes')}
                            hint={t('flushNote')}
                            state={f.writeIdleMinutes}
                            disabled={disabled}
                            t={t}
                            error={fill(t('invalid'), { min: 0.1 })}
                            onReset={() => controller.reset('writeIdleMinutes')}
                        >
                            <TextInput id="mb-idle" state={f.writeIdleMinutes} disabled={disabled} onEdit={(value) => controller.edit('writeIdleMinutes', value)} inputMode="decimal" />
                        </Field>
                    ) : null}
                    {!f.write.text ? null : (
                        <Field
                            id="mb-attachments"
                            label={t('attachments')}
                            hint={t(`attachHint_${attachmentMode}`)}
                            state={f.attachments}
                            disabled={disabled}
                            t={t}
                            onReset={() => controller.reset('attachments')}
                        >
                            <select
                                id="mb-attachments"
                                className="mb-input"
                                value={attachmentMode}
                                disabled={disabled}
                                onChange={(event: ChangeEvent<HTMLSelectElement>) => controller.edit('attachments', event.target.value)}
                            >
                                {FIELDS.attachments.options.map((name) => <option key={name} value={name}>{t(`attach_${name}`)}</option>)}
                            </select>
                        </Field>
                    )}
                </section>
                <section className="mb-group">
                    <h4 className="mb-group-title">{t('panelGroup')}</h4>
                    <SwitchField id="mb-panel" field="panel" label={t('panelSwitch')} hint={t('panelSwitchHint')} fields={f} disabled={disabled} t={t} controller={controller} />
                </section>
                <section className="mb-group">
                    <h4 className="mb-group-title">{t('preferenceGroup')}</h4>
                    <Field
                        id="mb-preference-mode"
                        label={t('preferenceMode')}
                        hint={`${t(`prefModeHint_${preferenceMode}`)}${preferenceMode === 'off' ? '' : ` ${t('prefModeNote')}`}`}
                        state={f.preferenceMode}
                        disabled={disabled}
                        t={t}
                        onReset={() => controller.reset('preferenceMode')}
                    >
                        <select
                            id="mb-preference-mode"
                            className="mb-input"
                            value={preferenceMode}
                            disabled={disabled}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) => controller.edit('preferenceMode', event.target.value)}
                        >
                            {FIELDS.preferenceMode.options.map((name) => <option key={name} value={name}>{t(`prefMode_${name}`)}</option>)}
                        </select>
                    </Field>
                </section>
                <section className="mb-group">
                    <details className="mb-adv">
                        <summary>{t('preferenceAdvanced')}</summary>
                        <Field
                            id="mb-pref-context"
                            label={t('preferenceContextMessages')}
                            hint={t('preferenceContextMessagesHint')}
                            state={f.preferenceContextMessages}
                            disabled={disabled}
                            t={t}
                            error={fill(t('invalidInt'), { min: 0 })}
                            onReset={() => controller.reset('preferenceContextMessages')}
                        >
                            <TextInput id="mb-pref-context" state={f.preferenceContextMessages} disabled={disabled} onEdit={(value) => controller.edit('preferenceContextMessages', value)} inputMode="numeric" />
                        </Field>
                        <Field
                            id="mb-pref-timeout"
                            label={t('preferenceTimeoutMs')}
                            hint={t('preferenceTimeoutMsHint')}
                            state={f.preferenceTimeoutMs}
                            disabled={disabled}
                            t={t}
                            error={fill(t('invalidInt'), { min: 1 })}
                            onReset={() => controller.reset('preferenceTimeoutMs')}
                        >
                            <TextInput id="mb-pref-timeout" state={f.preferenceTimeoutMs} disabled={disabled} onEdit={(value) => controller.edit('preferenceTimeoutMs', value)} inputMode="numeric" />
                        </Field>
                    </details>
                </section>
                <div className="mb-actions">
                    <button
                        type="button"
                        className="mb-save"
                        disabled={disabled || !s.dirty || s.invalid}
                        onClick={() => controller.save()}
                    >
                        {s.saving ? t('saving') : t('save')}
                    </button>
                    {s.notice?.kind === 'ok' ? <p className="mb-ok">{t('saved')}</p> : null}
                    {s.notice?.kind === 'error' ? <p className="mb-error">{fill(t('saveFailed'), { reason: s.notice.reason })}</p> : null}
                </div>
            </div>
        );
    };
}
