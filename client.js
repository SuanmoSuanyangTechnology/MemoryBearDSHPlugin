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
			writeIdleMinutes: { kind: "number", min: 0.1 }
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
			".mb-save:disabled{opacity:.5;cursor:default}"
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
						}, textInput("mb-idle", f.writeIdleMinutes, disabled, (v) => controller.edit("writeIdleMinutes", v), { inputMode: "decimal" })) : null),
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

		/** Required client services. */
		const inject = ["slots", "locale", "remote", "remote.credentials", "configForms"];

		/**
		 * Register the dictionaries and this bundle's configuration page.
		 * @param ctx - browser plugin context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-memorybear: dictionaries");
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
