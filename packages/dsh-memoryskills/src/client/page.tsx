/**
 * The configuration page shown on this bundle's page in dsh web's Plugins panel.
 *
 * @module dsh-memoryskills/client/page
 */
import { useEffect, useSyncExternalStore, type ChangeEvent, type ReactNode } from 'react';
import { fill, type ConfigController, type PageComponent, type PageProps } from '@redbear/dsh-memory-core/client';
import { Checkbox, Field, SwitchField, TextInput } from './components/form.js';
import { DEFAULT_PORTAL } from './constants.js';
import { FIELDS, SEARCH_MODES } from './form-schema.js';
import { loginURL } from './utils.js';

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
    return function MemorySkillsConfig({ t, view }: PageProps): ReactNode {
        const s = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
        // Leaving the page drops staged edits, like the official pages.
        useEffect(() => () => controller.discard(), []);
        if (view === 'summary') return t('summary');
        if (!s.available) return <p className="ms-hint">{s.loading ? t('loading') : t('unavailable')}</p>;

        const disabled = !s.writable || s.saving;
        const f = s.fields;
        const mode = f.writeMode.text || 'batch';
        const cred = s.credential;
        const keyLocked = cred.configured && !cred.writable;
        return (
            <div className="ms-cfg">
                {!s.writable ? <p className="ms-hint">{t('readOnly')}</p> : null}
                <section className="ms-group">
                    <h4 className="ms-group-title">{t('connection')}</h4>
                    <Field
                        id="ms-portal-url"
                        label={t('portalURL')}
                        hint={t('portalURLHint')}
                        state={f.portalURL}
                        disabled={disabled}
                        t={t}
                        onReset={() => controller.reset('portalURL')}
                    >
                        <TextInput
                            id="ms-portal-url"
                            state={f.portalURL}
                            disabled={disabled}
                            onEdit={(value) => controller.edit('portalURL', value)}
                            placeholder={DEFAULT_PORTAL}
                        />
                    </Field>
                    <Field
                        id="ms-api-key"
                        label={t('apiKey')}
                        hint={credentialHint(s, t)}
                        state={{ overridden: false, invalid: s.keyInvalid }}
                        error={t('apiKeyPrefix')}
                        disabled={disabled}
                        t={t}
                    >
                        <TextInput
                            id="ms-api-key"
                            type="password"
                            state={{ text: s.keyDraft, overridden: false, invalid: s.keyInvalid }}
                            disabled={disabled || keyLocked}
                            onEdit={(value) => controller.editKey(value)}
                            placeholder={cred.configured ? '••••••••' : 'sk-mem-…'}
                        />
                    </Field>
                    <a className="ms-link" href={loginURL(f.portalURL.text)} target="_blank" rel="noopener noreferrer">{t('login')}</a>
                </section>
                <section className="ms-group">
                    <h4 className="ms-group-title">{t('recallGroup')}</h4>
                    <SwitchField id="ms-profile" field="profile" label={t('profile')} hint={t('profileHint')} fields={f} disabled={disabled} t={t} controller={controller} />
                    <SwitchField id="ms-recall" field="recall" label={t('recall')} hint={t('recallHint')} fields={f} disabled={disabled} t={t} controller={controller} />
                    <Field
                        id="ms-search-switch"
                        label={t('searchSwitch')}
                        hint={t('searchSwitchHint')}
                        state={f.searchSwitch}
                        disabled={disabled}
                        t={t}
                        onReset={() => controller.reset('searchSwitch')}
                    >
                        <select
                            id="ms-search-switch"
                            className="ms-input"
                            value={f.searchSwitch.text || 'express'}
                            disabled={disabled}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) => controller.edit('searchSwitch', event.target.value)}
                        >
                            {SEARCH_MODES.map((modeName) => <option key={modeName} value={modeName}>{t(`search_${modeName}`)}</option>)}
                        </select>
                    </Field>
                    <SwitchField id="ms-tool" field="tool" label={t('tool')} hint={t('toolHint')} fields={f} disabled={disabled} t={t} controller={controller} />
                    {!f.tool.text ? null : (
                        <Field
                            id="ms-tool-switches"
                            label={t('toolSearchSwitches')}
                            hint={t('toolSearchSwitchesHint')}
                            state={f.toolSearchSwitches}
                            disabled={disabled}
                            t={t}
                            error={t('pickOne')}
                            onReset={() => controller.reset('toolSearchSwitches')}
                        >
                            <div className="ms-checks" id="ms-tool-switches">
                                {SEARCH_MODES.map((modeName) => (
                                    <Checkbox
                                        key={modeName}
                                        id={`ms-tool-${modeName}`}
                                        label={t(`search_${modeName}`)}
                                        checked={f.toolSearchSwitches.text.includes(modeName)}
                                        disabled={disabled}
                                        onEdit={(checked) => controller.edit('toolSearchSwitches', checked
                                            ? SEARCH_MODES.filter((item) => item === modeName || f.toolSearchSwitches.text.includes(item))
                                            : f.toolSearchSwitches.text.filter((item) => item !== modeName))}
                                    />
                                ))}
                            </div>
                        </Field>
                    )}
                </section>
                <section className="ms-group">
                    <h4 className="ms-group-title">{t('writing')}</h4>
                    <SwitchField id="ms-write" field="write" label={t('write')} hint={t('writeHint')} fields={f} disabled={disabled} t={t} controller={controller} />
                    {!f.write.text ? null : (
                        <Field
                            id="ms-write-mode"
                            label={t('writeMode')}
                            hint={t(`modeHint_${mode}`)}
                            state={f.writeMode}
                            disabled={disabled}
                            t={t}
                            onReset={() => controller.reset('writeMode')}
                        >
                            <select
                                id="ms-write-mode"
                                className="ms-input"
                                value={mode}
                                disabled={disabled}
                                onChange={(event: ChangeEvent<HTMLSelectElement>) => controller.edit('writeMode', event.target.value)}
                            >
                                {FIELDS.writeMode.options.map((modeName) => <option key={modeName} value={modeName}>{t(`mode_${modeName}`)}</option>)}
                            </select>
                        </Field>
                    )}
                    {f.write.text && mode === 'batch' ? (
                        <Field
                            id="ms-every"
                            label={t('writeEveryTurns')}
                            state={f.writeEveryTurns}
                            disabled={disabled}
                            t={t}
                            error={fill(t('invalidInt'), { min: 1 })}
                            onReset={() => controller.reset('writeEveryTurns')}
                        >
                            <TextInput id="ms-every" state={f.writeEveryTurns} disabled={disabled} onEdit={(value) => controller.edit('writeEveryTurns', value)} inputMode="numeric" />
                        </Field>
                    ) : null}
                    {f.write.text && mode !== 'turn' ? (
                        <Field
                            id="ms-idle"
                            label={t('writeIdleMinutes')}
                            hint={t('flushNote')}
                            state={f.writeIdleMinutes}
                            disabled={disabled}
                            t={t}
                            error={fill(t('invalid'), { min: 0.1 })}
                            onReset={() => controller.reset('writeIdleMinutes')}
                        >
                            <TextInput id="ms-idle" state={f.writeIdleMinutes} disabled={disabled} onEdit={(value) => controller.edit('writeIdleMinutes', value)} inputMode="decimal" />
                        </Field>
                    ) : null}
                </section>
                <div className="ms-actions">
                    <button
                        type="button"
                        className="ms-save"
                        disabled={disabled || !s.dirty || s.invalid}
                        onClick={() => controller.save()}
                    >
                        {s.saving ? t('saving') : t('save')}
                    </button>
                    {s.notice?.kind === 'ok' ? <p className="ms-ok">{t('saved')}</p> : null}
                    {s.notice?.kind === 'error' ? <p className="ms-error">{fill(t('saveFailed'), { reason: s.notice.reason })}</p> : null}
                </div>
            </div>
        );
    };
}
