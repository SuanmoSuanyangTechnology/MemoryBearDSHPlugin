/**
 * Inline stylesheet of the configuration page. dsh client plugins ship their
 * own CSS this way; the id makes injection idempotent across HMR reloads.
 *
 * @module dsh-memoryskills/client/styles
 */
import { PKG, STYLE_ID } from './constants.js';

const CSS = [
    '.ms-cfg{display:flex;flex-direction:column;gap:20px;color:var(--dsw-alias-label-primary);font-size:13px}',
    '.ms-group{display:flex;flex-direction:column}',
    '.ms-group-title{font-size:16px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary);margin:0 0 6px}',
    '.ms-field{display:flex;flex-direction:column;gap:6px;padding:12px 0}',
    '.ms-field+.ms-field{border-top:.5px solid var(--dsw-alias-border-l2)}',
    '.ms-head{display:flex;align-items:center;gap:8px}',
    '.ms-label{flex:1;font-weight:500;line-height:1.5}',
    '.ms-reset{font:inherit;font-size:12px;background:0 0;border:0;padding:0;cursor:pointer;color:var(--dsw-alias-label-secondary)}',
    '.ms-reset:hover{color:var(--dsw-alias-label-primary)}',
    '.ms-badge{font-size:11px;padding:1px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-4);color:var(--dsw-alias-label-secondary)}',
    '.ms-input{height:34px;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font:inherit;font-size:13px}',
    '.ms-input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}',
    '.ms-input:disabled{color:var(--dsw-alias-label-tertiary)}',
    '.ms-input[aria-invalid=true]{border-color:var(--dsw-alias-state-error-primary)}',
    '.ms-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
    '.ms-link{font-size:12px;color:var(--dsw-alias-brand-primary);text-decoration:none;align-self:flex-start}',
    '.ms-link:hover{text-decoration:underline}',
    '.ms-error{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}',
    '.ms-ok{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
    '.ms-actions{display:flex;align-items:center;gap:12px}',
    '.ms-check{display:inline-flex;align-items:center;gap:8px;cursor:pointer}',
    '.ms-checks{display:flex;flex-wrap:wrap;gap:16px;padding:4px 0}',
    '.ms-save{height:32px;padding:0 16px;border-radius:8px;border:0;font:inherit;font-size:13px;cursor:pointer;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-on-brand,#fff)}',
    '.ms-save:disabled{opacity:.5;cursor:default}',
].join('');

/** Inject the stylesheet once per document. */
export function installStyles(): void {
    if (typeof document === 'undefined') return;
    if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`) !== null) return;
    const tag = document.createElement('style');
    tag.dataset.plugin = PKG;
    tag.dataset.pluginCss = STYLE_ID;
    tag.textContent = CSS;
    document.head.appendChild(tag);
}
