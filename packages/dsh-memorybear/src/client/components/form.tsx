/**
 * Small controlled form primitives shared by the configuration page.
 *
 * @module dsh-memorybear/client/components/form
 */
import type { ChangeEvent, ReactNode } from 'react';
import type { ConfigController, FieldState, PageProps } from '@redbearai/dsh-memory-core/client';
import type { FIELDS, BooleanFieldName, FieldStates } from '../form-schema.js';

export interface FieldProps {
    id: string;
    label: ReactNode;
    hint?: ReactNode;
    state?: Pick<FieldState<unknown>, 'overridden' | 'invalid'>;
    disabled?: boolean;
    t: PageProps['t'];
    onReset?: () => void;
    error?: ReactNode;
    children: ReactNode;
}

/** One labelled control with override badge, reset and hint/error line. */
export function Field({ id, label, hint, state, disabled, t, onReset, error, children }: FieldProps): ReactNode {
    return (
        <div className="mb-field">
            <div className="mb-head">
                <label className="mb-label" htmlFor={id}>{label}</label>
                {state?.overridden ? <span className="mb-badge">{t('overridden')}</span> : null}
                {state?.overridden && onReset ? (
                    <button type="button" className="mb-reset" disabled={disabled} onClick={onReset}>{t('reset')}</button>
                ) : null}
            </div>
            {children}
            {state?.invalid && error ? <p className="mb-error">{error}</p> : hint ? <p className="mb-hint">{hint}</p> : null}
        </div>
    );
}

/** A text input with the shared styling. */
export function TextInput({
    id,
    state,
    disabled,
    onEdit,
    inputMode,
    placeholder,
    type = 'text',
}: {
    id: string;
    state: FieldState<string>;
    disabled: boolean;
    onEdit: (value: string) => void;
    inputMode?: 'numeric' | 'decimal';
    placeholder?: string;
    type?: 'text' | 'password';
}): ReactNode {
    return (
        <input
            id={id}
            className="mb-input"
            type={type}
            value={state.text}
            disabled={disabled}
            aria-invalid={state.invalid || undefined}
            autoComplete={type === 'password' ? 'off' : undefined}
            inputMode={inputMode}
            placeholder={placeholder}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onEdit(event.target.value)}
        />
    );
}

/** A checkbox with its label. */
export function Checkbox({
    id,
    label,
    checked,
    disabled,
    onEdit,
}: {
    id: string;
    label: ReactNode;
    checked: boolean;
    disabled: boolean;
    onEdit: (checked: boolean) => void;
}): ReactNode {
    return (
        <label className="mb-check" htmlFor={id}>
            <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onEdit(event.target.checked)}
            />
            <span>{label}</span>
        </label>
    );
}

/** A switch row: checkbox + override badge/reset + hint. */
export function SwitchField({
    id,
    field,
    label,
    hint,
    fields,
    disabled,
    t,
    controller,
}: {
    id: string;
    field: BooleanFieldName;
    label: ReactNode;
    hint?: ReactNode;
    fields: FieldStates;
    disabled: boolean;
    t: PageProps['t'];
    controller: ConfigController<typeof FIELDS>;
}): ReactNode {
    const state = fields[field];
    return (
        <div className="mb-field">
            <div className="mb-head">
                <div className="mb-label">
                    <Checkbox
                        id={id}
                        label={label}
                        checked={state.text}
                        disabled={disabled}
                        onEdit={(value) => controller.edit(field, value)}
                    />
                </div>
                {state.overridden ? <span className="mb-badge">{t('overridden')}</span> : null}
                {state.overridden ? (
                    <button type="button" className="mb-reset" disabled={disabled} onClick={() => controller.reset(field)}>{t('reset')}</button>
                ) : null}
            </div>
            {hint ? <p className="mb-hint">{hint}</p> : null}
        </div>
    );
}
