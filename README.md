# MemoryBear DSH Plugins

Long-term memory plugins for [DeepSeek Harness (dsh)](https://www.npmjs.com/package/@deepseek-ai/dsh), backed by MemoryBear.

| Package | Backend | What you configure |
|---|---|---|
| [`packages/dsh-memorybear`](packages/dsh-memorybear) — `@kesun5/dsh-memorybear` | MemoryBear Enterprise V1 API | API base URL, workspace API key, `end_user_id` |
| [`packages/dsh-memoryskills`](packages/dsh-memoryskills) — `@kesun5/dsh-memoryskills` | MemorySkills Portal (MCP `read_memory` + REST write) | Portal URL, personal `sk-mem-` key |

Both plugins load a user profile at session start, expose a `memory_search` tool, write conversations back to memory (per turn / every N turns / on idle), and ship a config form on the dsh Plugins page.

Install one of them, not both: each registers its own `memory_search` tool.

```bash
dsh plugin --profile <profile> add @kesun5/dsh-memorybear
# or
dsh plugin --profile <profile> add @kesun5/dsh-memoryskills
```

## Development

Each package is self-contained (own `package.json` and lockfile):

```bash
cd packages/<package>
pnpm install
node test/<test-file>.test.mjs
```

Release tags are prefixed with the package name, e.g. `dsh-memorybear@v0.1.0-alpha.6`.
