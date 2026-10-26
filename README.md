# MemoryBear DSH Plugins

Long-term memory plugins for [DeepSeek Harness (dsh)](https://www.npmjs.com/package/@deepseek-ai/dsh), backed by MemoryBear.

| Package | Backend | What you configure |
|---|---|---|
| [`packages/dsh-memorybear`](packages/dsh-memorybear) — `@redbearai/dsh-memorybear` | MemoryBear Enterprise V1 API | API base URL, workspace API key, `end_user_id` |
| [`packages/dsh-memoryskills`](packages/dsh-memoryskills) — `@redbearai/dsh-memoryskills` | MemorySkills Portal (MCP `read_memory` + REST write) | Portal URL, personal `sk-mem-` key |

`packages/dsh-memory-core` (`@redbearai/dsh-memory-core`) is the internal shared package: dsh Host adapter, HTTP URL builder and the browser config-form framework. Do not install it directly; the two plugins depend on it.

Both plugins load a user profile at session start, expose a `memory_search` tool, write conversations back to memory (per turn / every N turns / on idle), and ship a config form on the dsh Plugins page.

Install one of them, not both: each registers its own `memory_search` tool.

```bash
dsh plugin --profile <profile> add @redbearai/dsh-memorybear
# or
dsh plugin --profile <profile> add @redbearai/dsh-memoryskills
```

## Development

The repository is a pnpm workspace with one lockfile. All plugin code is
TypeScript 6.x under `src/`; `pnpm build` writes the layout used by
official dsh plugins: one bundled Host file `lib/index.js`, one browser file
`lib/client.js`, and declarations under `lib/types/`. Locale copy lives in JSON:
`locale/*.json` is dsh plugin metadata, `src/client/locale/*.json` is UI copy
bundled into `lib/client.js`.

```bash
pnpm install           # install all workspace packages
pnpm run typecheck     # typecheck core + both plugins
pnpm run test          # build + unit tests for core + both plugins
pnpm run build         # build core first, then both plugins
```

Or work on one package (the core is built automatically):

```bash
cd packages/dsh-memorybear
pnpm run typecheck
pnpm test
```

Release tags are prefixed with the package name, e.g. `dsh-memorybear@v0.1.0-alpha.6`
or `dsh-memory-core@v0.1.0`. Published tarballs ship the prebuilt `lib/`; a source
checkout must run `pnpm build` before linking or packing.

## License

Apache-2.0. See [LICENSE](LICENSE).
