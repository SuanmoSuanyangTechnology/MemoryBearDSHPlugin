/**
 * Right-sidebar 记忆 tab: memory counts, tags, emotion history, profile and
 * topic cards, fetched from the Host's `/api/memorybear/insights` route.
 *
 * @module dsh-memorybear/client/panel
 */
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { fill, type Translate } from '@redbearai/dsh-memory-core/client';
import { INSIGHTS_PATH, NS, PANEL_ID, PKG } from './constants.js';
import type { MemoryBearPanelContext } from './types.js';

interface EmotionRow {
    type?: string;
    display_name?: string;
    count?: number;
    percentage?: number;
}

interface EmotionDay {
    date?: string;
    dialogue_count?: number;
    emotions?: EmotionRow[];
}

interface ProfileField {
    key: string;
    label: string;
    items: string[];
}

interface ProfileEntity {
    summary?: string;
    description?: string;
    fields?: ProfileField[];
}

interface MemorySummary {
    tags?: string[];
    total?: number;
    active?: number;
    limit?: number | null;
}

interface TopicCard {
    id: string;
    name: string;
    summary: string;
    members: number;
    entities: string[];
}

interface InsightPart<T> {
    ok: boolean;
    data?: T;
    error?: string;
}

interface PanelData {
    disabled?: boolean;
    configured?: boolean;
    missing?: string[];
    profile?: InsightPart<ProfileEntity>;
    overview?: InsightPart<{ conclusion?: { title?: string; message?: string }; data_quality?: string }>;
    timeline?: InsightPart<{ items?: EmotionDay[] }>;
    memory?: InsightPart<MemorySummary>;
    communities?: InsightPart<TopicCard[]>;
}

interface PanelState {
    loading: boolean;
    data?: PanelData;
    error?: string;
    at?: Date;
}

/** Emotion bucket colours (MemoryBear's 10 buckets plus legacy fear/surprise). */
const EMOTION_COLOR: Record<string, string> = {
    joy: '#f2b233', relief: '#7cc49a', hope: '#5fb0e6', neutral: '#a3a9b3', confusion: '#b59ad8',
    anxiety: '#e8875b', sadness: '#6f8fd0', loneliness: '#8a7fb8', frustration: '#d9736f', anger: '#d04f4f',
    fear: '#9b6fb0', surprise: '#e3a3c8',
};

const emotionColor = (type: string | undefined): string => EMOTION_COLOR[type ?? ''] ?? '#a3a9b3';

/** Display name for an emotion code, from the locale (`emo_<code>`), falling back to the code. */
function emotionName(t: Translate, type: string | undefined, fallback?: string): string {
    const key = `emo_${type ?? ''}`;
    const text = t(key);
    return text && text !== key && !text.endsWith(key) ? text : (fallback || type || '');
}

/** Read `/api/memorybear/insights` (Host route; same browser session as the page). */
async function loadInsights(signal: AbortSignal): Promise<PanelData> {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const res = await fetch(`${INSIGHTS_PATH}?tz=${encodeURIComponent(timeZone)}`, { credentials: 'same-origin', signal });
    if (res.status === 404) return { disabled: true };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<PanelData>;
}

/** One titled panel section with either its body or the part's error. */
function Section({ title, part, t, children }: { title?: string; part?: InsightPart<unknown>; t: Translate; children: ReactNode }): ReactNode {
    return (
        <section className="mb-sec">
            {title ? <h4 className="mb-sec-title">{title}</h4> : null}
            {part && !part.ok ? <p className="mb-error">{fill(t('panelPartFailed'), { reason: part.error ?? '' })}</p> : children}
        </section>
    );
}

/** Collapsible block; closed by default. */
function Fold({ label, children }: { label: string; children: ReactNode }): ReactNode {
    return (
        <details className="mb-fold">
            <summary>{label}</summary>
            <div className="mb-fold-body">{children}</div>
        </details>
    );
}

/** One stat tile: small label, big value, sub line. */
function Tile({ label, value, unit, sub, dot }: { label: string; value: ReactNode; unit?: string | null; sub?: ReactNode; dot?: string | null }): ReactNode {
    return (
        <div className="mb-tile">
            <span className="mb-tile-label">{label}</span>
            <span className="mb-big">
                {dot ? <i className="mb-dot" style={{ background: dot }} /> : null}
                {value}
                {unit ? <small>{unit}</small> : null}
            </span>
            {sub ? <span className="mb-tile-sub">{sub}</span> : null}
        </div>
    );
}

/** Stacked percentage bar plus legend for one day's emotions. */
function EmotionBar({ emotions, t }: { emotions: readonly EmotionRow[] | undefined; t: Translate }): ReactNode {
    const list = (emotions ?? []).filter((emotion) => (emotion.percentage ?? 0) > 0);
    if (list.length === 0) return <p className="mb-hint">{t('panelNoEmotion')}</p>;
    return (
        <Fragment>
            <div
                className="mb-bar"
                role="img"
                aria-label={list.map((emotion) => `${emotionName(t, emotion.type, emotion.display_name)} ${emotion.percentage}%`).join(', ')}
            >
                {list.map((emotion) => (
                    <span key={emotion.type} style={{ width: `${emotion.percentage}%`, background: emotionColor(emotion.type) }} />
                ))}
            </div>
            <div className="mb-legend">
                {list.map((emotion) => (
                    <span key={emotion.type}>
                        <i className="mb-dot" style={{ background: emotionColor(emotion.type) }} />
                        {`${emotionName(t, emotion.type, emotion.display_name)} ${Math.round(emotion.percentage ?? 0)}%`}
                    </span>
                ))}
            </div>
        </Fragment>
    );
}

/** Emotion totals over the timeline days, shaped like a day's `emotions` rows. */
function emotionTotals(days: readonly EmotionDay[]): EmotionRow[] {
    const counts = new Map<string, number>();
    const names = new Map<string, string>();
    for (const day of days) {
        for (const emotion of day.emotions ?? []) {
            const type = emotion.type ?? '';
            counts.set(type, (counts.get(type) ?? 0) + (Number(emotion.count) || 0));
            if (emotion.display_name) names.set(type, emotion.display_name);
        }
    }
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    return [...counts]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, display_name: names.get(type), count, percentage: total ? (count * 100) / total : 0 }));
}

/** The emotion with the largest share on one day, or undefined. */
function topEmotion(day: EmotionDay | undefined): EmotionRow | undefined {
    return [...(day?.emotions ?? [])]
        .filter((emotion) => (emotion.percentage ?? 0) > 0)
        .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0];
}

/** Split the profile `description` (`[ISO time] text；...`) into lines, dropping timestamps. */
function descriptionLines(text: string | undefined): string[] {
    return String(text ?? '').split(/[；;]\s*/).map((line) => line.replace(/^\[[^\]]*\]\s*/, '').trim()).filter(Boolean);
}

/** Entity chips shown before a card's "show more". */
const COMMUNITY_CHIPS = 4;

/** One topic card: name, size, summary, core entities (first few, rest on demand). */
function CommunityCard({ card, t }: { card: TopicCard; t: Translate }): ReactNode {
    const [open, setOpen] = useState(false);
    const shown = open ? card.entities : card.entities.slice(0, COMMUNITY_CHIPS);
    const rest = card.entities.length - shown.length;
    return (
        <div className="mb-comm">
            <div className="mb-comm-head">
                <span className="mb-comm-name" title={card.name}>{card.name || t('panelTopicUnnamed')}</span>
                <span className="mb-comm-count">{fill(t('panelTopicMembers'), { n: card.members })}</span>
            </div>
            {card.summary ? <p className="mb-comm-sum">{card.summary}</p> : null}
            {shown.length > 0 ? (
                <div className="mb-chips">
                    {shown.map((entity) => <span key={entity} className="mb-chip" title={entity}>{entity}</span>)}
                </div>
            ) : null}
            {rest > 0 ? <button type="button" className="mb-more" onClick={() => setOpen(true)}>{fill(t('panelTopicMore'), { n: rest })}</button> : null}
        </div>
    );
}

/** Sidebar 记忆 tab body: profile, recent emotions, tags and memory topics. */
export function MemoryPanel({ t }: { t: Translate }): ReactNode {
    const [state, setState] = useState<PanelState>({ loading: true });
    const [nonce, setNonce] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setState((current) => ({ ...current, loading: true }));
        loadInsights(controller.signal).then(
            (data) => setState({ loading: false, data, at: new Date() }),
            (error: unknown) => {
                if (!controller.signal.aborted) setState({ loading: false, error: String(error instanceof Error ? error.message : error) });
            },
        );
        return () => controller.abort();
    }, [nonce]);
    const { loading, data, error, at } = state;
    const bar = (
        <div className="mb-panel-bar">
            <p className="mb-hint">{loading ? t('loading') : at ? fill(t('panelUpdated'), { time: at.toLocaleTimeString() }) : ''}</p>
            <button type="button" className="mb-refresh" disabled={loading} onClick={() => setNonce((value) => value + 1)}>{t('panelRefresh')}</button>
        </div>
    );
    if (error) return <div className="mb-panel">{bar}<p className="mb-error">{fill(t('panelFailed'), { reason: error })}</p></div>;
    if (!data) return <div className="mb-panel">{bar}</div>;
    if (data.disabled) return <div className="mb-panel">{bar}<p className="mb-hint">{t('panelDisabled')}</p></div>;
    if (!data.configured) return <div className="mb-panel">{bar}<p className="mb-hint">{fill(t('panelUnconfigured'), { missing: (data.missing ?? []).join(', ') })}</p></div>;

    const profile = data.profile?.data;
    const overview = data.overview?.data;
    const days = data.timeline?.data?.items ?? [];
    const memory = data.memory?.data;
    const communities = data.communities?.data ?? [];
    const latest = days[0];
    const top = topEmotion(latest);
    const totals = emotionTotals(days);
    const description = profile ? descriptionLines(profile.description) : [];
    const fields = profile?.fields ?? [];
    // The first field shows open; the rest sit behind one fold.
    const field = (item: ProfileField) => (
        <div key={item.key} className="mb-kv">
            <b>{t(`pf_${item.key}`) || item.label}</b>
            <ul>{item.items.map((value, index) => <li key={index}>{value}</li>)}</ul>
        </div>
    );
    const restCount = fields.length - 1 + (description.length > 0 ? 1 : 0);
    return (
        <div className="mb-panel">
            {bar}
            <div className="mb-tiles">
                {!data.memory?.ok ? <Tile label={t('panelTitle')} value="—" sub={data.memory?.error} />
                    : <Tile
                        label={t('panelTitle')}
                        value={memory ? memory.total : '—'}
                        unit={memory ? t('panelMemoryUnit') : null}
                        sub={memory ? fill(t('panelMemoryActive'), { active: memory.active ?? 0 }) : t('panelEmpty')}
                    />}
                <Tile
                    label={t('panelLatest')}
                    value={top ? emotionName(t, top.type, top.display_name) : '—'}
                    dot={top ? emotionColor(top.type) : null}
                    sub={latest ? fill(t('panelLatestOn'), { date: String(latest.date).slice(5), n: latest.dialogue_count ?? 0 }) : t('panelEmpty')}
                />
            </div>
            <Section title={t('panelMemoryTags')} part={data.memory} t={t}>
                {!memory?.tags?.length ? <p className="mb-hint">{t('panelEmpty')}</p>
                    : <div className="mb-chips">{memory.tags.map((tag) => <span key={tag} className="mb-chip">{tag}</span>)}</div>}
            </Section>
            <Section title={days.length > 0 ? fill(t('panelEmotionDays'), { n: days.length }) : t('panelTimeline')} part={data.timeline} t={t}>
                {days.length === 0 ? <p className="mb-hint">{t('panelEmpty')}</p> : (
                    <Fragment>
                        <EmotionBar emotions={totals} t={t} />
                        {data.overview?.ok && overview?.conclusion && overview.data_quality !== 'no_data'
                            ? <p className="mb-note"><b>{overview.conclusion.title}</b>{overview.conclusion.message ? ` · ${overview.conclusion.message}` : ''}</p>
                            : null}
                        <Fold label={t('panelByDay')}>
                            {days.map((day) => (
                                <div key={day.date} className="mb-day">
                                    <div className="mb-day-head"><span>{day.date}</span><span>{fill(t('panelDialogues'), { n: day.dialogue_count ?? 0 })}</span></div>
                                    <EmotionBar emotions={day.emotions} t={t} />
                                </div>
                            ))}
                        </Fold>
                    </Fragment>
                )}
            </Section>
            <Section title={t('panelProfile')} part={data.profile} t={t}>
                {!profile ? <p className="mb-hint">{t('panelEmpty')}</p> : (
                    <Fragment>
                        {profile.summary ? <p className="mb-summary">{profile.summary}</p> : null}
                        {fields[0] ? field(fields[0]) : null}
                        {restCount > 0 ? (
                            <Fold label={fill(t('panelMore'), { n: restCount })}>
                                {fields.slice(1).map(field)}
                                {description.length > 0 ? <ul className="mb-hint mb-desc">{description.map((line, index) => <li key={index}>{line}</li>)}</ul> : null}
                            </Fold>
                        ) : null}
                    </Fragment>
                )}
            </Section>
            <Section title={t('panelTopics')} part={data.communities} t={t}>
                {communities.length === 0 ? <p className="mb-hint">{t('panelEmpty')}</p>
                    : communities.map((card) => <CommunityCard key={card.id} card={card} t={t} />)}
            </Section>
        </div>
    );
}

/** Register the 记忆 tab in the right sidebar (guide entry + body). */
export function applyPanel(ctx: MemoryBearPanelContext): void {
    const t = ctx.locale.bind(NS);
    ctx.effect(() => ctx.sidebarRightTabs.register({
        id: PANEL_ID,
        kind: 'memorybear',
        priority: 'extension',
        title: () => t('panelTitle'),
        guide: [{ id: 'open', order: 60, title: () => t('panelTitle'), description: () => t('panelGuide') }],
    }), `${PKG}: panel type`);
    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: PANEL_ID,
        locale: NS,
    }, MemoryPanel)), `${PKG}: panel body`);
}
