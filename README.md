# dsh-memorybear

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）接入 MemoryBear 长期记忆的插件。

- **召回**：会话第一轮加载 MemoryBear 用户画像（`meta`），也可以每轮自动召回一次（`recall: true`）。
- **工具**：`memory_search`，由模型按需调用，档位（express / quick / normal / deep）也由模型选。
- **写入**：一轮对话完成后，把用户原话和助手最后一条回复写入 MemoryBear。可以每轮写、每 N 轮写，或者会话空闲后再写。
- **网页配置页**：在 dsh 网页版的 Plugins 页里可以改配置。API key 存在 dsh 的凭据库里，不写进配置文件。

测试环境：dsh **0.2.0-rc.2**，Node 22，2026-10-14。dsh 还是预发布版，接口在不同版本之间会变。如果你用的 dsh 版本和这里不一样，先按下面的「验证」一节跑一遍。

## 网络与数据

插件只连你在配置里填的 `baseURL`，用到这些接口：

| 接口 | 用途 |
|---|---|
| `POST {baseURL}/memory/read/sync` | 画像、召回、`memory_search` |
| `POST {baseURL}/memory/write` | 写入对话（只写用户原话和助手最后一条回复，附件以 `files` 字段带上） |
| `POST {baseURL}/memory/files/upload` | 上传用户消息里的图片/文件（`attachments` 不为 `none` 时） |
| `GET {baseURL}/memory/emotion-memory/query_emotion_overview`、`GET .../query_emotion_timeline` | 右侧边栏"记忆"标签页的近期情绪、情绪记录（`panel` 开启时） |
| `GET {baseURL}/dashboard/end_users?keyword=<endUserId>` | 右侧边栏"记忆"标签页的记忆标签和记忆条数（按 `endUserId` 精确挑出本人那一行；`panel` 开启时） |

右侧边栏"记忆"标签页的数据由插件在 dsh 服务端注册的 `GET /api/memorybear/insights` 转发，dsh 负责登录校验，API key 不会发到浏览器。

插件不会创建 end_user，需要事先建好（可以用 `scripts/create_end_user.py`）。

请求头带 `Authorization: Bearer <key>`。子代理（subagent）会话不召回也不写入。

## 安装

```sh
dsh plugin --profile <你的 profile> add @kesun5/dsh-memorybear@0.1.0-alpha.4
```

桌面端在插件页的"包名或地址"里填同样的 `@kesun5/dsh-memorybear@0.1.0-alpha.4`。

- 一律写明版本号：pnpm 11 有新版冷却期（`minimumReleaseAge`），不带版本号时刚发布的版本可能被跳过，装成旧版。
- `add` 会自动把插件加进 profile 的 `dsh.profile.bundles`，不用手动改 `package.json`。
- `add` 底层是 PATH 里的 pnpm（npm 装的 dsh 不自带）。实测 pnpm 11 可用；没有 pnpm 时执行 `npm i -g pnpm@11`。
- 从 alpha.1/alpha.2 升级：这两版依赖 `@deepseek-ai/dsh-tools`，会在 profile 的 `node_modules` 里多装一份，导致该 profile 所有工具调用报 `Cannot read properties of undefined (reading 'prepare')`，或插件卡在"等待依赖 tools"。alpha.3 去掉了这个依赖。升级后若 `<profile>/node_modules/@deepseek-ai/dsh-tools` 还在，先卸载插件再装 alpha.3，然后完全退出 dsh / 桌面端（Cmd+Q）再打开。

也可以用 git 地址（`github:keeees/MemoryBearDSHPlugin#v0.1.0-alpha.4`）或 tgz 文件安装。本地开发时可以用 `link:` 依赖指向源码目录。

## 配置

写在 profile 自己的 `cordis.patch.yml` 里：

```yaml
- id: memorybear-memory
  config:
    baseURL: https://<memorybear-host>/v1
    endUserId: <end_user uuid>
    apiKeyEnv: MEMORYBEAR_API_KEY   # key 从这个环境变量或 dsh 凭据库读取，不要写进配置文件
    profile: true                   # 会话首轮加载画像
    recall: false                   # 关掉每轮自动召回，改由模型按需调 memory_search
```

也可以用 `!!js` 从环境变量读，避免把地址和 ID 写死：

```yaml
    baseURL: !!js (process.env.MEMORY_SERVICE_BASE_URL ?? '').replace(/\/+$/, '').replace(/(\/v1)?$/, '/v1')
    endUserId: !!js process.env.MEMORY_ENDUSER_ID ?? ''
```

完整选项和默认值：

| 选项 | 默认 | 说明 |
|---|---|---|
| `baseURL` | 空 | V1 服务 API 根地址。和 `endUserId` 都填上之前插件不连服务（召回、写入都不做，`memory_search` 返回"未配置"） |
| `endUserId` | 空 | 一个 dsh 用户对应一个固定的 MemoryBear end_user |
| `apiKeyEnv` | `MEMORYBEAR_API_KEY` | API key 的凭据引用 |
| `profile` | `false` | 会话首轮加载 `meta` 画像 |
| `recall` | `true` | 每轮自动召回 |
| `searchSwitch` | `express` | 自动召回用的档位 |
| `tool` | `true` | 注册 `memory_search` |
| `toolSearchSwitches` | `[express, quick, normal, deep]` | 模型可选的档位 |
| `slowSearchTimeoutMs` | `15000` | normal/deep 超时后降级到 quick |
| `write` | `true` | 是否写入 |
| `writeMode` | `turn` | `turn` 每轮写 / `batch` 每 N 轮写 / `idle` 空闲后写；会话或插件销毁时会补写 |
| `writeEveryTurns` | `3` | batch 模式下每几轮写一次 |
| `writeIdleMinutes` | `10` | 空闲多久算空闲 |
| `attachments` | `images` | 附件写入：`none` 不写 / `images` 只写图片 / `all` 图片加 MemoryBear 能解析的文档、音频、视频 |
| `maxAttachmentMB` | `20` | 单个附件超过这个大小就跳过 |
| `panel` | `true` | 右侧边栏"记忆"标签页（记忆数、记忆标签、近期情绪、情绪记录、画像） |
| `panelTimeoutMs` | `20000` | 标签页每个数据请求的超时 |
| `recallTimeoutMs` / `toolTimeoutMs` / `writeTimeoutMs` | `8000` / `30000` / `15000` | 各请求超时 |
| `maxRecallChars` | `4000` | 注入的记忆文本上限 |
| `minQueryChars` | `2` | 短于这个长度的输入（如"好""继续"）不召回 |
| `language` | `zh` | 写入时的 `X-Language-Type` |

## 验证

```sh
# 单元测试，不需要 dsh 和真实服务
node test/client-page.test.mjs
MOCK_LOG=/tmp/mock.jsonl node test/write-modes.test.mjs

# 端到端：本地 mock 服务 + 真实 dsh
node test/mock-memorybear.mjs 18765 mock.jsonl &
MEMORY_SERVICE_BASE_URL=http://127.0.0.1:18765 MEMORY_SERVICE_API_KEY=mock \
  uv run python scripts/run_dsh.py "我最喜欢什么颜色？"
```

mock 服务预置的记忆是"最喜欢的颜色是靛蓝色"。`mock.jsonl` 里应该能看到 `read/sync` 和 `write` 请求。`scripts/run_dsh.py` 从 `~/.config/redbear/secrets.env` 读取 LLM 和 MemoryBear 的 key，并通过子进程环境变量传给 dsh。

## 目录

| 路径 | 内容 |
|---|---|
| `index.js` | 服务端插件，全部逻辑都在这里 |
| `client.js` | 网页 Plugins 页的配置界面 |
| `cordis.patch.yml` | bundle 补丁，把插件插进 profile |
| `test/` | 单元测试和 mock 服务 |
| `scripts/` | 启动 dsh、直连探测服务、建 end_user 等脚本 |
| `examples/tutorial/` | 插件开发教程的 4 个示例 |
| `docs/` | 插件开发教程（md/html）和实现说明 |

## License

Apache-2.0
