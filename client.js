/**
 * Browser half of @kesun5/dsh-memorybear: the configuration page shown on
 * this bundle's page in dsh web's Plugins panel (`plugins.bundle.config`).
 *
 * Hand-written in the client module loader's lazy-CJS factory format (the
 * shape dsh's own `lib/client.js` bundles use), so no build step is needed.
 * React and the dsh client services are supplied by the host page; nothing is
 * bundled here.
 *
 * The page edits the `memorybear` settings namespace the Host half registers
 * (connection + write mode) and writes the API key through the credentials
 * domain, so the key never lands in the settings document and is never read
 * back into the browser.
 */
window.__ModuleLoader__.load({
	id: "@kesun5/dsh-memorybear",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		const h = React.createElement;

		/** Package name: the key of this bundle's `plugins.bundle.config` entry. */
		const PKG = "@kesun5/dsh-memorybear";
		/**
		 * Config form namespace: since dsh 0.2 this is the Host profile entry id
		 * (index.js SETTINGS_NAMESPACE, set by the bundle patch).
		 */
		const SETTINGS_NS = "memorybear-memory";
		/** Locale dictionary namespace. */
		const NS = "memorybear";
		/** Credential reference used when the section names none (index.js default). */
		const DEFAULT_KEY_REF = "MEMORYBEAR_API_KEY";

		/** Editable section fields and how their text maps to stored values. */
		const SEARCH_MODES = ["express", "quick", "normal", "deep"];
		const FIELDS = {
			profile: { kind: "bool" },
			recall: { kind: "bool" },
			searchSwitch: { kind: "select", options: SEARCH_MODES },
			toolSearchSwitches: { kind: "multi", options: SEARCH_MODES },
			write: { kind: "bool" },
			baseURL: { kind: "text" },
			endUserId: { kind: "text" },
			writeMode: { kind: "select", options: ["turn", "batch", "idle"] },
			writeEveryTurns: { kind: "int", min: 1 },
			writeIdleMinutes: { kind: "number", min: 0.1 },
			attachments: { kind: "select", options: ["none", "images", "all"] },
			panel: { kind: "bool" }
		};

		const zh = {
			summary: "长期记忆：服务连接与写入模式",
			loading: "加载中…",
			unavailable: "插件的设置还没加载（插件未启用或本部署没有设置存储），暂时不能配置。",
			readOnly: "本部署的设置为只读。",
			recallGroup: "召回",
			profile: "会话首轮加载用户画像",
			profileHint: "每个会话第一轮调一次 meta，把画像放进对话；画像为空时不加。",
			recall: "每轮自动召回",
			recallHint: "每轮开头按用户原话查一次记忆。关掉时只靠模型主动调 memory_search。",
			searchSwitch: "自动召回档位",
			searchSwitchHint: "自动召回用这一档；也是 memory_search 不指定档位时的默认值。",
			toolSearchSwitches: "memory_search 可选档位",
			toolSearchSwitchesHint: "模型调工具时只能从这里勾选的档位里选。test 环境上 normal/deep 很慢，建议不勾。",
			pickOne: "至少勾选一个档位。",
			search_express: "express 关键词",
			search_quick: "quick 混合",
			search_normal: "normal 拆解汇总",
			search_deep: "deep 深度",
			write: "写入记忆",
			writeHint: "关掉后只读不写，适合测试时不想污染记忆。关掉时未写入的内容会立即补写。",
			connection: "连接",
			baseURL: "服务地址",
			baseURLHint: "MemoryBear V1 接口根地址，例如 https://<host>/v1。",
			endUserId: "end_user ID",
			endUserIdHint: "这个 dsh 用户对应的 MemoryBear 用户 UUID。",
			apiKey: "API Key",
			apiKeySet: "已配置密钥（来源：{source}）。",
			apiKeyUnset: "未配置密钥；配置之前读写记忆都会被拒绝。",
			apiKeyEnvLocked: "密钥由启动环境变量 {ref} 提供，这里不能改；要改请在启动环境里改。",
			apiKeyHint: "保存在 dsh 凭据库（{ref}），不写进设置文件。留空表示保持当前密钥。",
			writing: "写入",
			writeMode: "写入模式",
			mode_turn: "每轮结束写入",
			mode_batch: "每 N 轮写入一次",
			mode_idle: "会话空闲后写入",
			modeHint_turn: "每一轮正常结束就写入，记忆最及时，请求最多。",
			modeHint_batch: "攒够 N 轮一起写；不够 N 轮时，会话空闲到设定时间也会写入。",
			modeHint_idle: "会话停下来超过设定时间后，把这段对话一次写入。",
			writeEveryTurns: "每几轮写一次",
			writeIdleMinutes: "空闲多久后写入（分钟）",
			flushNote: "会话关闭或 dsh 退出时，未写入的内容会尽量补写；进程被直接杀掉时可能丢失。",
			attachments: "附件写入",
			attach_none: "不写附件，只写文字",
			attach_images: "写入图片",
			attach_all: "写入图片和文件",
			attachHint_none: "用户发的图片和文件都不上传。",
			attachHint_images: "用户发的图片随这一轮上传到 MemoryBear；文件不上传。",
			attachHint_all: "图片和 MemoryBear 能解析的文件（文档、音频、视频）都上传；其他类型和超过大小上限（默认 20MB）的跳过。",
			panelTitle: "记忆",
			panelSwitch: "右侧栏记忆面板",
			panelSwitchHint: "在会话右侧栏加一个“记忆”标签页，显示记忆数、记忆标签、情绪记录和用户画像。关掉后标签页显示已关闭。",
			panelGuide: "MemoryBear 里的记忆数、记忆标签、近期情绪和用户画像",
			panelRefresh: "刷新",
			panelUpdated: "{time} 更新",
			panelFailed: "记忆加载失败：{reason}",
			panelPartFailed: "暂时拿不到：{reason}",
			panelDisabled: "记忆面板已在插件设置里关闭。",
			panelUnconfigured: "MemoryBear 还没配置（缺 {missing}），请先在插件页填写。",
			panelEmpty: "暂无数据。",
			panelProfile: "用户画像",
			panelMemoryUnit: "条记忆",
			panelMemoryActive: "{active} 条活跃",
			panelLatest: "最近情绪",
			panelLatestOn: "{date} · {n} 段对话",
			panelMemoryTags: "记忆标签",
			panelTimeline: "情绪记录",
			panelEmotionDays: "近 {n} 个活跃日情绪",
			panelByDay: "按天查看",
			panelMore: "展开其余 {n} 项",
			panelDialogues: "{n} 段对话",
			panelNoEmotion: "没有记录到情绪",
			pf_core_facts: "核心事实", pf_traits: "性格特点", pf_interests: "兴趣", pf_goals: "目标",
			pf_beliefs_or_stances: "观点立场", pf_relations: "人际关系", pf_event_timeline: "事件时间线", pf_anchors: "关键锚点",
			emo_joy: "喜悦", emo_relief: "释然", emo_hope: "希望", emo_neutral: "平静", emo_confusion: "困惑", emo_anxiety: "焦虑",
			emo_sadness: "悲伤", emo_loneliness: "孤独", emo_frustration: "挫败", emo_anger: "愤怒", emo_fear: "恐惧", emo_surprise: "惊讶",
			overridden: "已覆盖",
			reset: "恢复默认",
			save: "保存",
			saving: "保存中…",
			saved: "已保存，下一次读写记忆即生效，无需重启。",
			saveFailed: "保存没有生效：{reason}",
			invalid: "请填写不小于 {min} 的数字。",
			invalidInt: "请填写不小于 {min} 的整数。"
		};
		const en = {
			summary: "Long-term memory: service connection and write mode",
			loading: "Loading…",
			unavailable: "The plugin's settings are not loaded (plugin disabled or no settings store), so it cannot be configured right now.",
			readOnly: "This deployment stores settings read-only.",
			recallGroup: "Recall",
			profile: "Load the user profile on a session's first turn",
			profileHint: "Calls meta once per session and adds the profile to the conversation; skipped when empty.",
			recall: "Recall automatically every turn",
			recallHint: "Queries memory with the user's words at the start of each turn. When off, only memory_search calls by the model read memory.",
			searchSwitch: "Automatic recall mode",
			searchSwitchHint: "Used by automatic recall, and by memory_search when the model names no mode.",
			toolSearchSwitches: "Modes memory_search may use",
			toolSearchSwitchesHint: "The model can only pick from the checked modes. normal/deep are slow on the test server.",
			pickOne: "Check at least one mode.",
			search_express: "express keyword",
			search_quick: "quick hybrid",
			search_normal: "normal decompose",
			search_deep: "deep",
			write: "Write memory",
			writeHint: "When off, memory is read but never written. Turns already buffered are written right away.",
			connection: "Connection",
			baseURL: "Service URL",
			baseURLHint: "MemoryBear V1 API root, e.g. https://<host>/v1.",
			endUserId: "end_user ID",
			endUserIdHint: "The MemoryBear user UUID for this dsh user.",
			apiKey: "API key",
			apiKeySet: "A key is configured (source: {source}).",
			apiKeyUnset: "No key is configured; memory reads and writes are rejected until one is.",
			apiKeyEnvLocked: "The key comes from the launch environment variable {ref} and cannot be changed here.",
			apiKeyHint: "Stored in dsh's credential store ({ref}), not in the settings file. Leave blank to keep the current key.",
			writing: "Writing",
			writeMode: "Write mode",
			mode_turn: "After every turn",
			mode_batch: "Every N turns",
			mode_idle: "When the session goes idle",
			modeHint_turn: "Writes as soon as each turn completes: freshest memory, most requests.",
			modeHint_batch: "Writes N turns together; a shorter tail is written once the session has been idle for the set time.",
			modeHint_idle: "Writes the conversation in one call once the session has been idle for the set time.",
			writeEveryTurns: "Turns per write",
			writeIdleMinutes: "Idle time before writing (minutes)",
			flushNote: "Unwritten turns are flushed when a session closes or dsh exits; a killed process may lose them.",
			attachments: "Attachments",
			attach_none: "Text only",
			attach_images: "Write images",
			attach_all: "Write images and files",
			attachHint_none: "Images and files the user attaches are not uploaded.",
			attachHint_images: "Images the user attaches are uploaded to MemoryBear with the turn; files are not.",
			attachHint_all: "Images and files MemoryBear can parse (documents, audio, video) are uploaded; other types and anything over the size cap (20 MB by default) are skipped.",
			panelTitle: "Memory",
			panelSwitch: "Memory panel in the right sidebar",
			panelSwitchHint: "Adds a Memory tab to the session's right sidebar with memory counts, memory tags, emotion history and the user profile. When off, the tab says it is turned off.",
			panelGuide: "Memory counts, memory tags, recent emotions and profile from MemoryBear",
			panelRefresh: "Refresh",
			panelUpdated: "Updated {time}",
			panelFailed: "Could not load memory: {reason}",
			panelPartFailed: "Not available: {reason}",
			panelDisabled: "The memory panel is turned off in this plugin's settings.",
			panelUnconfigured: "MemoryBear is not configured yet (missing {missing}). Fill it in on the Plugins page.",
			panelEmpty: "No data yet.",
			panelProfile: "Profile",
			panelMemoryUnit: "memories",
			panelMemoryActive: "{active} active",
			panelLatest: "Latest emotion",
			panelLatestOn: "{date} · {n} dialogues",
			panelMemoryTags: "Memory tags",
			panelTimeline: "Emotion history",
			panelEmotionDays: "Emotions over {n} active days",
			panelByDay: "By day",
			panelMore: "Show {n} more",
			panelDialogues: "{n} dialogues",
			panelNoEmotion: "No emotion recorded",
			pf_core_facts: "Core facts", pf_traits: "Traits", pf_interests: "Interests", pf_goals: "Goals",
			pf_beliefs_or_stances: "Beliefs / stances", pf_relations: "Relations", pf_event_timeline: "Event timeline", pf_anchors: "Anchors",
			emo_joy: "Joy", emo_relief: "Relief", emo_hope: "Hope", emo_neutral: "Neutral", emo_confusion: "Confusion", emo_anxiety: "Anxiety",
			emo_sadness: "Sadness", emo_loneliness: "Loneliness", emo_frustration: "Frustration", emo_anger: "Anger", emo_fear: "Fear", emo_surprise: "Surprise",
			overridden: "Overridden",
			reset: "Reset to default",
			save: "Save",
			saving: "Saving…",
			saved: "Saved. Takes effect on the next memory call, no restart needed.",
			saveFailed: "The save did not land: {reason}",
			invalid: "Enter a number of at least {min}.",
			invalidInt: "Enter a whole number of at least {min}."
		};

		/** Fill `{name}` placeholders; works whether or not the host `t` interpolates. */
		function fill(text, vars) {
			return String(text).replace(/\{(\w+)\}/g, (all, k) => (vars && k in vars ? String(vars[k]) : all));
		}

		/**
		 * Parse one field's draft text.
		 * @returns {{kind:'clear'}|{kind:'set',value:unknown}|undefined} undefined = invalid
		 */
		function parseField(field, text) {
			const spec = FIELDS[field];
			if (spec.kind === "bool") return { kind: "set", value: Boolean(text) };
			if (spec.kind === "multi") {
				const picked = spec.options.filter((o) => Array.isArray(text) && text.includes(o));
				return picked.length > 0 ? { kind: "set", value: picked } : void 0;
			}
			const trimmed = String(text).trim();
			if (trimmed === "") return { kind: "clear" };
			if (spec.kind === "text") return { kind: "set", value: trimmed };
			if (spec.kind === "select") return spec.options.includes(trimmed) ? { kind: "set", value: trimmed } : void 0;
			const n = Number(trimmed);
			if (!Number.isFinite(n) || n < spec.min) return void 0;
			if (spec.kind === "int" && !Number.isInteger(n)) return void 0;
			return { kind: "set", value: n };
		}

		function formatValue(value) {
			return value === void 0 || value === null ? "" : String(value);
		}

		/** Draft representation of a stored value: raw for bool/multi, text otherwise. */
		function formatField(field, value) {
			const kind = FIELDS[field].kind;
			if (kind === "bool") return Boolean(value);
			if (kind === "multi") return Array.isArray(value) ? [...value] : [];
			return formatValue(value);
		}

		const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

		/**
		 * Staged form over the `memorybear` scope plus the credential status.
		 * Exposes getSnapshot/subscribe for React's useSyncExternalStore.
		 */
		class ConfigController {
			constructor(ctx, scope) {
				this.ctx = ctx;
				this.scope = scope;
				/** field -> { text, clear } */
				this.drafts = new Map();
				this.keyDraft = "";
				this.credential = { ref: "", configured: false, writable: true, source: void 0 };
				this.saving = false;
				this.notice = null;
				this.listeners = new Set();
				this.snapshot = this.project();
				this.getSnapshot = () => this.snapshot;
				this.subscribe = (listener) => {
					this.listeners.add(listener);
					return () => this.listeners.delete(listener);
				};
				this.unsubscribe = scope.subscribe(() => {
					this.readCredential();
					this.publish();
				});
				this.readCredential();
			}

			/** Stop following the shared form (the configForms provider owns it). */
			dispose() {
				this.unsubscribe?.();
			}

			publish() {
				this.snapshot = this.project();
				for (const listener of this.listeners) listener();
			}

			ref() {
				const declared = this.scope.getSnapshot().value?.apiKeyEnv;
				return typeof declared === "string" && declared.length > 0 ? declared : DEFAULT_KEY_REF;
			}

			stored(field) {
				const user = this.scope.getSnapshot().user;
				return Boolean(user && typeof user === "object" && Object.prototype.hasOwnProperty.call(user, field));
			}

			/** One control's state: shown text, override badge, validity. */
			field(field) {
				const snap = this.scope.getSnapshot();
				const draft = this.drafts.get(field);
				if (draft === void 0) return { text: formatField(field, snap.value?.[field]), overridden: this.stored(field), invalid: false };
				if (draft.clear) return { text: formatField(field, snap.base?.[field]), overridden: false, invalid: false };
				const write = parseField(field, draft.text);
				return { text: draft.text, overridden: write?.kind === "set", invalid: write === void 0 };
			}

			project() {
				const snap = this.scope.getSnapshot();
				const fields = {};
				for (const field of Object.keys(FIELDS)) fields[field] = this.field(field);
				const invalid = Object.values(fields).some((f) => f.invalid);
				const dirty = this.drafts.size > 0 || this.keyDraft.trim() !== "";
				return {
					available: snap.status === "ready",
					loading: snap.status === "loading",
					writable: snap.writable,
					fields,
					keyDraft: this.keyDraft,
					credential: { ...this.credential },
					dirty,
					invalid,
					saving: this.saving,
					notice: this.notice
				};
			}

			async readCredential() {
				const ref = this.ref();
				if (ref !== this.credential.ref) this.credential = { ref, configured: false, writable: true, source: void 0 };
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
					source: view?.source
				};
				this.publish();
			}

			refreshCredential(ref) {
				if (ref === this.credential.ref) this.readCredential();
			}

			edit(field, text) {
				this.drafts.set(field, { text, clear: false });
				this.notice = null;
				this.publish();
			}

			reset(field) {
				this.drafts.set(field, { text: "", clear: true });
				this.notice = null;
				this.publish();
			}

			editKey(text) {
				this.keyDraft = text;
				this.notice = null;
				this.publish();
			}

			discard() {
				if (this.drafts.size === 0 && this.keyDraft === "" && this.notice === null) return;
				this.drafts.clear();
				this.keyDraft = "";
				this.notice = null;
				this.publish();
			}

			/** Write staged fields in one mutation and the key through credentials, then read back. */
			async save() {
				const snap = this.scope.getSnapshot();
				if (this.saving || snap.status !== "ready" || !snap.writable) return;
				const ops = [];
				const expected = new Map();
				for (const [field, draft] of this.drafts) {
					const write = draft.clear ? { kind: "clear" } : parseField(field, draft.text);
					if (write === void 0) return;
					if (write.kind === "clear") {
						if (this.stored(field)) {
							ops.push({ op: "unset", path: [field] });
							expected.set(field, { clear: true });
						}
					} else if (!sameValue(write.value, snap.value?.[field]) || !this.stored(field)) {
						ops.push({ op: "set", path: [field], value: write.value });
						expected.set(field, { value: write.value });
					}
				}
				const key = this.keyDraft.trim();
				this.saving = true;
				this.notice = null;
				this.publish();
				const failures = [];
				if (key !== "") {
					try {
						const response = await this.ctx.remote.credentials.set(this.ref(), key);
						if (response && response.ok === false) failures.push(response.error?.message ?? "credential-rejected");
					} catch (error) {
						failures.push(String(error?.message ?? error));
					}
					await this.readCredential();
				}
				if (ops.length > 0) {
					try {
						await this.scope.mutate(ops);
					} catch (error) {
						failures.push(String(error?.message ?? error));
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
					this.keyDraft = "";
					this.notice = { kind: "ok" };
				} else {
					this.notice = { kind: "error", reason: failures.join(", ") };
				}
				this.publish();
			}
		}

		const CSS = [
			".mb-cfg{display:flex;flex-direction:column;gap:20px;color:var(--dsw-alias-label-primary);font-size:13px}",
			".mb-group{display:flex;flex-direction:column}",
			".mb-group-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);margin:0 0 4px}",
			".mb-field{display:flex;flex-direction:column;gap:6px;padding:12px 0}",
			".mb-field+.mb-field{border-top:.5px solid var(--dsw-alias-border-l2)}",
			".mb-head{display:flex;align-items:center;gap:8px}",
			".mb-label{flex:1;font-weight:500;line-height:1.5}",
			".mb-reset{font:inherit;font-size:12px;background:0 0;border:0;padding:0;cursor:pointer;color:var(--dsw-alias-label-secondary)}",
			".mb-reset:hover{color:var(--dsw-alias-label-primary)}",
			".mb-badge{font-size:11px;padding:1px 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-4);color:var(--dsw-alias-label-secondary)}",
			".mb-input{height:34px;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font:inherit;font-size:13px}",
			".mb-input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}",
			".mb-input:disabled{color:var(--dsw-alias-label-tertiary)}",
			".mb-input[aria-invalid=true]{border-color:var(--dsw-alias-state-error-primary)}",
			".mb-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}",
			".mb-error{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}",
			".mb-ok{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}",
			".mb-actions{display:flex;align-items:center;gap:12px}",
			".mb-check{display:inline-flex;align-items:center;gap:8px;cursor:pointer}",
			".mb-checks{display:flex;flex-wrap:wrap;gap:16px;padding:4px 0}",
			".mb-save{height:32px;padding:0 16px;border-radius:8px;border:0;font:inherit;font-size:13px;cursor:pointer;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-on-brand,#fff)}",
			".mb-save:disabled{opacity:.5;cursor:default}",
			// Right-sidebar memory panel (layout A: stat tiles, then details)
			".mb-panel{display:flex;flex-direction:column;gap:20px;padding:16px;height:100%;overflow:auto;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}",
			".mb-panel-bar{display:flex;align-items:center;gap:8px;margin-bottom:-8px}",
			".mb-panel-bar .mb-hint{flex:1;font-size:11px}",
			".mb-refresh{font:inherit;font-size:12px;height:24px;padding:0 10px;border-radius:999px;border:0;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);cursor:pointer}",
			".mb-refresh:hover{color:var(--dsw-alias-label-primary)}",
			".mb-refresh:disabled{opacity:.5;cursor:default}",
			".mb-tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
			".mb-tile{display:flex;flex-direction:column;gap:2px;padding:12px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);min-width:0}",
			".mb-tile-label{font-size:11px;color:var(--dsw-alias-label-tertiary)}",
			".mb-big{font-size:22px;font-weight:600;line-height:1.2;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".mb-big small{font-size:12px;font-weight:400;color:var(--dsw-alias-label-secondary)}",
			".mb-tile-sub{font-size:11px;color:var(--dsw-alias-label-secondary)}",
			".mb-sec{display:flex;flex-direction:column;gap:8px}",
			".mb-sec-title{margin:0;font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}",
			".mb-chips{display:flex;flex-wrap:wrap;gap:6px}",
			".mb-chip{font-size:12px;padding:3px 10px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-label-primary)}",
			".mb-note{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary)}",
			".mb-note b{color:var(--dsw-alias-label-primary);font-weight:500}",
			".mb-fold{border-radius:12px;background:var(--dsw-alias-bg-layer-2);padding:4px 12px}",
			".mb-fold>summary{cursor:pointer;padding:8px 0;font-size:12px;color:var(--dsw-alias-label-secondary);list-style:none;display:flex;justify-content:space-between}",
			".mb-fold>summary::-webkit-details-marker{display:none}",
			".mb-fold>summary::after{content:'›';transition:transform .15s}",
			".mb-fold[open]>summary::after{transform:rotate(90deg)}",
			"@media (prefers-reduced-motion:reduce){.mb-fold>summary::after{transition:none}}",
			".mb-fold-body{padding:0 0 10px;display:flex;flex-direction:column;gap:10px}",
			".mb-summary{margin:0}",
			".mb-desc{margin:0;padding-left:18px}",
			".mb-kv{display:flex;flex-direction:column;gap:2px}",
			".mb-kv b{font-size:11px;font-weight:600;color:var(--dsw-alias-label-tertiary)}",
			".mb-kv ul{margin:0;padding-left:18px}",
			".mb-day{display:flex;flex-direction:column;gap:4px;padding:6px 0}",
			".mb-day+.mb-day{border-top:.5px solid var(--dsw-alias-border-l2)}",
			".mb-day-head{display:flex;justify-content:space-between;font-size:12px;color:var(--dsw-alias-label-secondary)}",
			".mb-bar{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;background:var(--dsw-alias-bg-layer-3)}",
			".mb-day .mb-bar{height:6px}",
			".mb-bar span{display:block;height:100%}",
			".mb-legend{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;color:var(--dsw-alias-label-secondary)}",
			".mb-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:middle}"
		].join("");
		const STYLE_ID = "@kesun5/dsh-memorybear/config.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = PKG;
			tag.dataset.pluginCss = STYLE_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		/** One labelled control with override badge, reset and hint/error line. */
		function Field({ id, label, hint, state, disabled, t, onReset, error, children }) {
			return h("div", { className: "mb-field" },
				h("div", { className: "mb-head" },
					h("label", { className: "mb-label", htmlFor: id }, label),
					state?.overridden ? h("span", { className: "mb-badge" }, t("overridden")) : null,
					state?.overridden && onReset ? h("button", { type: "button", className: "mb-reset", disabled, onClick: onReset }, t("reset")) : null),
				children,
				state?.invalid && error ? h("p", { className: "mb-error" }, error) : hint ? h("p", { className: "mb-hint" }, hint) : null);
		}

		function textInput(id, state, disabled, onEdit, extra = {}) {
			return h("input", {
				id,
				className: "mb-input",
				type: "text",
				value: state.text,
				disabled,
				"aria-invalid": state.invalid || void 0,
				onChange: (event) => onEdit(event.target.value),
				...extra
			});
		}

		function checkbox(id, label, state, disabled, onEdit) {
			return h("label", { className: "mb-check", htmlFor: id },
				h("input", { id, type: "checkbox", checked: Boolean(state.text), disabled, onChange: (event) => onEdit(event.target.checked) }),
				h("span", null, label));
		}

		/** A switch row: checkbox + override badge/reset + hint. */
		function SwitchField({ id, field, label, hint, f, disabled, t, controller }) {
			const state = f[field];
			return h("div", { className: "mb-field" },
				h("div", { className: "mb-head" },
					h("div", { className: "mb-label" }, checkbox(id, label, state, disabled, (v) => controller.edit(field, v))),
					state.overridden ? h("span", { className: "mb-badge" }, t("overridden")) : null,
					state.overridden ? h("button", { type: "button", className: "mb-reset", disabled, onClick: () => controller.reset(field) }, t("reset")) : null),
				hint ? h("p", { className: "mb-hint" }, hint) : null);
		}

		function makePage(controller) {
			return function MemoryBearConfig({ t, view }) {
				const s = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot);
				// Leaving the page drops staged edits, like the official pages.
				React.useEffect(() => () => controller.discard(), []);
				if (view === "summary") return t("summary");
				if (!s.available) return h("p", { className: "mb-hint" }, s.loading ? t("loading") : t("unavailable"));
				const disabled = !s.writable || s.saving;
				const f = s.fields;
				const mode = f.writeMode.text || "turn";
				const cred = s.credential;
				const keyLocked = cred.configured && !cred.writable;
				return h("div", { className: "mb-cfg" },
					!s.writable ? h("p", { className: "mb-hint" }, t("readOnly")) : null,
					h("section", { className: "mb-group" },
						h("h4", { className: "mb-group-title" }, t("recallGroup")),
						h(SwitchField, { id: "mb-profile", field: "profile", label: t("profile"), hint: t("profileHint"), f, disabled, t, controller }),
						h(SwitchField, { id: "mb-recall", field: "recall", label: t("recall"), hint: t("recallHint"), f, disabled, t, controller }),
						h(SwitchField, { id: "mb-panel", field: "panel", label: t("panelSwitch"), hint: t("panelSwitchHint"), f, disabled, t, controller }),
						h(Field, { id: "mb-search-switch", label: t("searchSwitch"), hint: t("searchSwitchHint"), state: f.searchSwitch, disabled, t, onReset: () => controller.reset("searchSwitch") },
							h("select", {
								id: "mb-search-switch",
								className: "mb-input",
								value: f.searchSwitch.text || "express",
								disabled,
								onChange: (event) => controller.edit("searchSwitch", event.target.value)
							}, SEARCH_MODES.map((m) => h("option", { key: m, value: m }, t(`search_${m}`))))),
						h(Field, {
							id: "mb-tool-switches", label: t("toolSearchSwitches"), hint: t("toolSearchSwitchesHint"),
							state: f.toolSearchSwitches, disabled, t, error: t("pickOne"), onReset: () => controller.reset("toolSearchSwitches")
						}, h("div", { className: "mb-checks", id: "mb-tool-switches" }, SEARCH_MODES.map((m) => checkbox(
							`mb-tool-${m}`, t(`search_${m}`), { text: f.toolSearchSwitches.text.includes(m) }, disabled,
							(on) => controller.edit("toolSearchSwitches", on
								? SEARCH_MODES.filter((x) => x === m || f.toolSearchSwitches.text.includes(x))
								: f.toolSearchSwitches.text.filter((x) => x !== m))))))),
					h("section", { className: "mb-group" },
						h("h4", { className: "mb-group-title" }, t("connection")),
						h(Field, { id: "mb-base-url", label: t("baseURL"), hint: t("baseURLHint"), state: f.baseURL, disabled, t, onReset: () => controller.reset("baseURL") },
							textInput("mb-base-url", f.baseURL, disabled, (v) => controller.edit("baseURL", v), { placeholder: "https://<host>/v1" })),
						h(Field, { id: "mb-end-user", label: t("endUserId"), hint: t("endUserIdHint"), state: f.endUserId, disabled, t, onReset: () => controller.reset("endUserId") },
							textInput("mb-end-user", f.endUserId, disabled, (v) => controller.edit("endUserId", v))),
						h(Field, {
							id: "mb-api-key",
							label: t("apiKey"),
							hint: keyLocked
								? fill(t("apiKeyEnvLocked"), { ref: cred.ref })
								: [cred.configured ? fill(t("apiKeySet"), { source: cred.source ?? "?" }) : t("apiKeyUnset"), fill(t("apiKeyHint"), { ref: cred.ref })].join(" "),
							disabled,
							t
						}, h("input", {
							id: "mb-api-key",
							className: "mb-input",
							type: "password",
							autoComplete: "off",
							value: s.keyDraft,
							disabled: disabled || keyLocked,
							placeholder: cred.configured ? "••••••••" : "",
							onChange: (event) => controller.editKey(event.target.value)
						}))),
					h("section", { className: "mb-group" },
						h("h4", { className: "mb-group-title" }, t("writing")),
						h(SwitchField, { id: "mb-write", field: "write", label: t("write"), hint: t("writeHint"), f, disabled, t, controller }),
						!f.write.text ? null : h(Field, { id: "mb-write-mode", label: t("writeMode"), hint: t(`modeHint_${mode}`), state: f.writeMode, disabled, t, onReset: () => controller.reset("writeMode") },
							h("select", {
								id: "mb-write-mode",
								className: "mb-input",
								value: mode,
								disabled,
								onChange: (event) => controller.edit("writeMode", event.target.value)
							}, FIELDS.writeMode.options.map((m) => h("option", { key: m, value: m }, t(`mode_${m}`))))),
						f.write.text && mode === "batch" ? h(Field, {
							id: "mb-every", label: t("writeEveryTurns"), state: f.writeEveryTurns, disabled, t,
							error: fill(t("invalidInt"), { min: 1 }), onReset: () => controller.reset("writeEveryTurns")
						}, textInput("mb-every", f.writeEveryTurns, disabled, (v) => controller.edit("writeEveryTurns", v), { inputMode: "numeric" })) : null,
						f.write.text && mode !== "turn" ? h(Field, {
							id: "mb-idle", label: t("writeIdleMinutes"), hint: t("flushNote"), state: f.writeIdleMinutes, disabled, t,
							error: fill(t("invalid"), { min: 0.1 }), onReset: () => controller.reset("writeIdleMinutes")
						}, textInput("mb-idle", f.writeIdleMinutes, disabled, (v) => controller.edit("writeIdleMinutes", v), { inputMode: "decimal" })) : null,
						!f.write.text ? null : h(Field, {
							id: "mb-attachments", label: t("attachments"), hint: t(`attachHint_${f.attachments.text || "images"}`),
							state: f.attachments, disabled, t, onReset: () => controller.reset("attachments")
						}, h("select", {
							id: "mb-attachments",
							className: "mb-input",
							value: f.attachments.text || "images",
							disabled,
							onChange: (event) => controller.edit("attachments", event.target.value)
						}, FIELDS.attachments.options.map((m) => h("option", { key: m, value: m }, t(`attach_${m}`)))))),
					h("div", { className: "mb-actions" },
						h("button", {
							type: "button",
							className: "mb-save",
							disabled: disabled || !s.dirty || s.invalid,
							onClick: () => controller.save()
						}, s.saving ? t("saving") : t("save")),
						s.notice?.kind === "ok" ? h("p", { className: "mb-ok" }, t("saved")) : null,
						s.notice?.kind === "error" ? h("p", { className: "mb-error" }, fill(t("saveFailed"), { reason: s.notice.reason })) : null));
			};
		}

		/** Emotion bucket colours (MemoryBear's 10 buckets plus legacy fear/surprise). */
		const EMOTION_COLOR = {
			joy: "#f2b233", relief: "#7cc49a", hope: "#5fb0e6", neutral: "#a3a9b3", confusion: "#b59ad8",
			anxiety: "#e8875b", sadness: "#6f8fd0", loneliness: "#8a7fb8", frustration: "#d9736f", anger: "#d04f4f",
			fear: "#9b6fb0", surprise: "#e3a3c8"
		};
		const emotionColor = (type) => EMOTION_COLOR[type] ?? "#a3a9b3";
		/** Display name for an emotion code, from the locale (`emo_<code>`), falling back to the code. */
		const emotionName = (t, type, fallback) => {
			const key = `emo_${type}`;
			const text = t(key);
			return text && text !== key && !text.endsWith(key) ? text : (fallback || type);
		};

		/**
		 * Read `/api/memorybear/insights` (Host route; same browser session as the page).
		 * @returns {Promise<object>} the route payload
		 */
		async function loadInsights(signal) {
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
			const res = await fetch(`/api/memorybear/insights?tz=${encodeURIComponent(tz)}`, { credentials: "same-origin", signal });
			if (res.status === 404) return { disabled: true };
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		}

		/** One titled panel section with either its body or the part's error. */
		function Section({ title, part, t, children }) {
			return h("section", { className: "mb-sec" },
				title ? h("h4", { className: "mb-sec-title" }, title) : null,
				part && !part.ok ? h("p", { className: "mb-error" }, fill(t("panelPartFailed"), { reason: part.error })) : children);
		}

		/** Collapsible block; closed by default. */
		function Fold({ label, children }) {
			return h("details", { className: "mb-fold" }, h("summary", null, label), h("div", { className: "mb-fold-body" }, children));
		}

		/** One stat tile: small label, big value, sub line. */
		function Tile({ label, value, unit, sub, dot }) {
			return h("div", { className: "mb-tile" },
				h("span", { className: "mb-tile-label" }, label),
				h("span", { className: "mb-big" }, dot ? h("i", { className: "mb-dot", style: { background: dot } }) : null, value, unit ? h("small", null, unit) : null),
				sub ? h("span", { className: "mb-tile-sub" }, sub) : null);
		}

		/** Stacked percentage bar plus legend for one day's emotions. */
		function EmotionBar({ emotions, t }) {
			const list = (emotions ?? []).filter((e) => e.percentage > 0);
			if (!list.length) return h("p", { className: "mb-hint" }, t("panelNoEmotion"));
			return h(React.Fragment, null,
				h("div", { className: "mb-bar", role: "img", "aria-label": list.map((e) => `${emotionName(t, e.type, e.display_name)} ${e.percentage}%`).join(", ") },
					list.map((e) => h("span", { key: e.type, style: { width: `${e.percentage}%`, background: emotionColor(e.type) } }))),
				h("div", { className: "mb-legend" }, list.map((e) => h("span", { key: e.type },
					h("i", { className: "mb-dot", style: { background: emotionColor(e.type) } }),
					`${emotionName(t, e.type, e.display_name)} ${Math.round(e.percentage)}%`))));
		}

		/**
		 * Emotion totals over the timeline days, shaped like a day's `emotions`
		 * rows so `EmotionBar` can draw them.
		 */
		function emotionTotals(days) {
			const counts = new Map();
			const names = new Map();
			for (const d of days) for (const e of d.emotions ?? []) {
				counts.set(e.type, (counts.get(e.type) ?? 0) + (Number(e.count) || 0));
				if (e.display_name) names.set(e.type, e.display_name);
			}
			const total = [...counts.values()].reduce((a, b) => a + b, 0);
			return [...counts].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
				.map(([type, n]) => ({ type, display_name: names.get(type), count: n, percentage: total ? (n * 100) / total : 0 }));
		}

		/** The emotion with the largest share on one day, or undefined. */
		const topEmotion = (day) => [...(day?.emotions ?? [])].filter((e) => e.percentage > 0).sort((a, b) => b.percentage - a.percentage)[0];

		/** Split the profile `description` (`[ISO time] text；...`) into lines, dropping the timestamps. */
		function descriptionLines(text) {
			return String(text ?? "").split(/[；;]\s*/).map((s) => s.replace(/^\[[^\]]*\]\s*/, "").trim()).filter(Boolean);
		}

		/** Right-sidebar 记忆 tab body: profile (metadata), recent emotions and emotion tags. */
		function MemoryPanel({ t }) {
			const [state, setState] = React.useState({ loading: true });
			const [nonce, setNonce] = React.useState(0);
			React.useEffect(() => {
				const ac = new AbortController();
				setState((s) => ({ ...s, loading: true }));
				loadInsights(ac.signal).then(
					(data) => setState({ loading: false, data, at: new Date() }),
					(error) => { if (!ac.signal.aborted) setState({ loading: false, error: String(error?.message ?? error) }); });
				return () => ac.abort();
			}, [nonce]);
			const { loading, data, error, at } = state;
			const bar = h("div", { className: "mb-panel-bar" },
				h("p", { className: "mb-hint" }, loading ? t("loading") : at ? fill(t("panelUpdated"), { time: at.toLocaleTimeString() }) : ""),
				h("button", { type: "button", className: "mb-refresh", disabled: loading, onClick: () => setNonce((n) => n + 1) }, t("panelRefresh")));
			if (error) return h("div", { className: "mb-panel" }, bar, h("p", { className: "mb-error" }, fill(t("panelFailed"), { reason: error })));
			if (!data) return h("div", { className: "mb-panel" }, bar);
			if (data.disabled) return h("div", { className: "mb-panel" }, bar, h("p", { className: "mb-hint" }, t("panelDisabled")));
			if (!data.configured) return h("div", { className: "mb-panel" }, bar, h("p", { className: "mb-hint" }, fill(t("panelUnconfigured"), { missing: (data.missing ?? []).join(", ") })));
			const profile = data.profile?.data;
			const overview = data.overview?.data;
			const days = data.timeline?.data?.items ?? [];
			const memory = data.memory?.data;
			const latest = days[0];
			const top = topEmotion(latest);
			const totals = emotionTotals(days);
			const desc = profile ? descriptionLines(profile.description) : [];
			const fields = profile?.fields ?? [];
			// The first field shows open; the rest sit behind one fold.
			const field = (f) => h("div", { key: f.key, className: "mb-kv" },
				h("b", null, t(`pf_${f.key}`) || f.label),
				h("ul", null, f.items.map((item, i) => h("li", { key: i }, item))));
			const restCount = fields.length - 1 + (desc.length ? 1 : 0);
			return h("div", { className: "mb-panel" }, bar,
				h("div", { className: "mb-tiles" },
					!data.memory?.ok ? h(Tile, { label: t("panelTitle"), value: "—", sub: data.memory?.error })
						: h(Tile, { label: t("panelTitle"), value: memory ? memory.total : "—", unit: memory ? t("panelMemoryUnit") : null, sub: memory ? fill(t("panelMemoryActive"), { active: memory.active }) : t("panelEmpty") }),
					h(Tile, {
						label: t("panelLatest"),
						value: top ? emotionName(t, top.type, top.display_name) : "—",
						dot: top ? emotionColor(top.type) : null,
						sub: latest ? fill(t("panelLatestOn"), { date: String(latest.date).slice(5), n: latest.dialogue_count }) : t("panelEmpty")
					})),
				h(Section, { title: t("panelMemoryTags"), part: data.memory, t },
					!memory?.tags?.length ? h("p", { className: "mb-hint" }, t("panelEmpty"))
						: h("div", { className: "mb-chips" }, memory.tags.map((tag) => h("span", { key: tag, className: "mb-chip" }, tag)))),
				h(Section, { title: days.length ? fill(t("panelEmotionDays"), { n: days.length }) : t("panelTimeline"), part: data.timeline, t },
					!days.length ? h("p", { className: "mb-hint" }, t("panelEmpty")) : h(React.Fragment, null,
						h(EmotionBar, { emotions: totals, t }),
						data.overview?.ok && overview?.conclusion && overview.data_quality !== "no_data"
							? h("p", { className: "mb-note" }, h("b", null, overview.conclusion.title), overview.conclusion.message ? ` · ${overview.conclusion.message}` : "") : null,
						h(Fold, { label: t("panelByDay") }, days.map((d) => h("div", { key: d.date, className: "mb-day" },
							h("div", { className: "mb-day-head" }, h("span", null, d.date), h("span", null, fill(t("panelDialogues"), { n: d.dialogue_count }))),
							h(EmotionBar, { emotions: d.emotions, t })))))),
				h(Section, { title: t("panelProfile"), part: data.profile, t },
					!profile ? h("p", { className: "mb-hint" }, t("panelEmpty")) : h(React.Fragment, null,
						profile.summary ? h("p", { className: "mb-summary" }, profile.summary) : null,
						fields[0] ? field(fields[0]) : null,
						restCount > 0 ? h(Fold, { label: fill(t("panelMore"), { n: restCount }) },
							fields.slice(1).map(field),
							desc.length ? h("ul", { className: "mb-hint mb-desc" }, desc.map((line, i) => h("li", { key: i }, line))) : null) : null)));
		}

		/** Tab type id; also the slot key its body registers under. */
		const PANEL_ID = "@kesun5/dsh-memorybear/panel";

		/**
		 * Register the 记忆 tab in the right sidebar (guide entry + body).
		 * @param ctx - client Context holding `slots` and `sidebarRightTabs`.
		 */
		function applyPanel(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.sidebarRightTabs.register({
				id: PANEL_ID,
				kind: "memorybear",
				priority: "extension",
				title: () => t("panelTitle"),
				guide: [{ id: "open", order: 60, title: () => t("panelTitle"), description: () => t("panelGuide") }]
			}), "dsh-memorybear: panel type");
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: PANEL_ID,
				locale: NS
			}, MemoryPanel)), "dsh-memorybear: panel body");
		}

		/** Required client services. */
		const inject = ["slots", "locale", "remote", "remote.credentials", "configForms"];

		/**
		 * Register the dictionaries and this bundle's configuration page.
		 * @param ctx - browser plugin context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-memorybear: dictionaries");
			// Optional: the right sidebar exists only in compositions that mount it.
			ctx.inject(["sidebarRightTabs"], (pctx) => applyPanel(pctx));
			const controller = new ConfigController(ctx, ctx.configForms.get(SETTINGS_NS));
			ctx.effect(() => () => controller.dispose(), "dsh-memorybear: form subscription");
			ctx.effect(() => ctx.remote.$on("credentials/reference-updated", (ref) => {
				controller.refreshCredential(ref);
			}), "dsh-memorybear: credential invalidations");
			const Page = makePage(controller);
			// Shown only while the Host serves the entry (plugin enabled and mounted).
			ctx.effect(() => ctx.configForms.whileServed([SETTINGS_NS], () => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: PKG,
				locale: NS
			}, Page))), "dsh-memorybear: page");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
