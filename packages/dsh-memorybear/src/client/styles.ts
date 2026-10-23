/**
 * Inline stylesheet of the configuration page and the memory panel.
 * dsh client plugins ship their own CSS this way; the id makes injection
 * idempotent across HMR reloads.
 *
 * @module dsh-memorybear/client/styles
 */
import { PKG, STYLE_ID } from './constants.js';

const CSS = [
    '.mb-cfg{display:flex;flex-direction:column;gap:20px;color:var(--dsw-alias-label-primary);font-size:13px}',
    '.mb-group{display:flex;flex-direction:column}',
    '.mb-group-title{font-size:16px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary);margin:0 0 6px}',
    '.mb-adv{display:flex;flex-direction:column;gap:inherit}',
    '.mb-adv>summary{cursor:pointer;font-size:16px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}',
    '.mb-adv[open]>summary{margin-bottom:8px}',
    '.mb-field{display:flex;flex-direction:column;gap:6px;padding:12px 0}',
    '.mb-field+.mb-field{border-top:.5px solid var(--dsw-alias-border-l2)}',
    '.mb-head{display:flex;align-items:center;gap:8px}',
    '.mb-label{flex:1;font-weight:500;line-height:1.5}',
    '.mb-reset{font:inherit;font-size:12px;background:0 0;border:0;padding:0;cursor:pointer;color:var(--dsw-alias-label-secondary)}',
    '.mb-reset:hover{color:var(--dsw-alias-label-primary)}',
    '.mb-badge{font-size:11px;padding:1px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-4);color:var(--dsw-alias-label-secondary)}',
    '.mb-input{height:34px;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font:inherit;font-size:13px}',
    '.mb-input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}',
    '.mb-input:disabled{color:var(--dsw-alias-label-tertiary)}',
    '.mb-input[aria-invalid=true]{border-color:var(--dsw-alias-state-error-primary)}',
    '.mb-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
    '.mb-error{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}',
    '.mb-ok{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
    '.mb-actions{display:flex;align-items:center;gap:12px}',
    '.mb-check{display:inline-flex;align-items:center;gap:8px;cursor:pointer}',
    '.mb-checks{display:flex;flex-wrap:wrap;gap:16px;padding:4px 0}',
    '.mb-save{height:32px;padding:0 16px;border-radius:8px;border:0;font:inherit;font-size:13px;cursor:pointer;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-on-brand,#fff)}',
    '.mb-save:disabled{opacity:.5;cursor:default}',
    // Right-sidebar memory panel (layout A: stat tiles, then details)
    '.mb-panel{display:flex;flex-direction:column;gap:20px;padding:16px;height:100%;overflow:auto;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}',
    '.mb-panel-bar{display:flex;align-items:center;gap:8px;margin-bottom:-8px}',
    '.mb-panel-bar .mb-hint{flex:1;font-size:11px}',
    '.mb-refresh{font:inherit;font-size:12px;height:24px;padding:0 10px;border-radius:999px;border:0;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);cursor:pointer}',
    '.mb-refresh:hover{color:var(--dsw-alias-label-primary)}',
    '.mb-refresh:disabled{opacity:.5;cursor:default}',
    '.mb-tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.mb-tile{display:flex;flex-direction:column;gap:2px;padding:12px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);min-width:0}',
    '.mb-tile-label{font-size:11px;color:var(--dsw-alias-label-tertiary)}',
    '.mb-big{font-size:22px;font-weight:600;line-height:1.2;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.mb-big small{font-size:12px;font-weight:400;color:var(--dsw-alias-label-secondary)}',
    '.mb-tile-sub{font-size:11px;color:var(--dsw-alias-label-secondary)}',
    '.mb-sec{display:flex;flex-direction:column;gap:8px}',
    '.mb-sec-title{margin:0;font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}',
    '.mb-chips{display:flex;flex-wrap:wrap;gap:6px}',
    '.mb-chip{font-size:12px;padding:3px 10px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-label-primary)}',
    '.mb-note{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary)}',
    '.mb-note b{color:var(--dsw-alias-label-primary);font-weight:500}',
    '.mb-fold{border-radius:12px;background:var(--dsw-alias-bg-layer-2);padding:4px 12px}',
    '.mb-fold>summary{cursor:pointer;padding:8px 0;font-size:12px;color:var(--dsw-alias-label-secondary);list-style:none;display:flex;justify-content:space-between}',
    '.mb-fold>summary::-webkit-details-marker{display:none}',
    ".mb-fold>summary::after{content:'›';transition:transform .15s}",
    '.mb-fold[open]>summary::after{transform:rotate(90deg)}',
    '@media (prefers-reduced-motion:reduce){.mb-fold>summary::after{transition:none}}',
    '.mb-fold-body{padding:0 0 10px;display:flex;flex-direction:column;gap:10px}',
    '.mb-summary{margin:0}',
    '.mb-desc{margin:0;padding-left:18px}',
    '.mb-kv{display:flex;flex-direction:column;gap:2px}',
    '.mb-kv b{font-size:11px;font-weight:600;color:var(--dsw-alias-label-tertiary)}',
    '.mb-kv ul{margin:0;padding-left:18px}',
    '.mb-day{display:flex;flex-direction:column;gap:4px;padding:6px 0}',
    '.mb-day+.mb-day{border-top:.5px solid var(--dsw-alias-border-l2)}',
    '.mb-day-head{display:flex;justify-content:space-between;font-size:12px;color:var(--dsw-alias-label-secondary)}',
    '.mb-bar{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;background:var(--dsw-alias-bg-layer-3)}',
    '.mb-day .mb-bar{height:6px}',
    '.mb-bar span{display:block;height:100%}',
    '.mb-legend{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
    '.mb-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:middle}',
    // Topic (community) cards
    '.mb-comm{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:12px;background:var(--dsw-alias-bg-layer-2)}',
    '.mb-comm-head{display:flex;align-items:baseline;gap:8px;min-width:0}',
    '.mb-comm-name{font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mb-comm-count{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
    '.mb-comm-sum{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary)}',
    '.mb-comm .mb-chip{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-sizing:border-box}',
    '.mb-more{align-self:flex-start;font:inherit;font-size:12px;padding:0;border:0;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer}',
    '.mb-more:hover{color:var(--dsw-alias-label-primary)}',
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
