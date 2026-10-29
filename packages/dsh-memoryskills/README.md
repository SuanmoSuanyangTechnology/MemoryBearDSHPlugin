# dsh-memoryskills

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）接入 MemorySkills 长期记忆的插件。

MemorySkills 是 MemoryBear 的个人用户入口：用邮箱验证码登录 Portal 后拿到一个 `sk-mem-` key，Portal 自己注入 workspace 和 `end_user_id`，所以插件只需要 Portal 地址和这个 key。

- **召回**：会话第一轮加载用户画像（`meta`），也可以每轮自动召回（`recall: true`）。
- **写入**：一轮对话完成后，把用户原话和助手最后一条回复写成带时间标签的 transcript 写入 Portal。可以每轮写、每 N 轮写，或者会话空闲后再写。
- **工具**：`memory_search`，底层是 Portal 的 MCP `read_memory`；档位（express / quick / normal / deep）由模型选。
- **配置页**：dsh 网页版 Plugins 页里可以改配置；`sk-mem-` key 存在 dsh 凭据库，不写进配置文件。

## 安装

```sh
dsh plugin --profile <你的 profile> add @redbearai/dsh-memoryskills@0.2.4
```

## 配置

```yaml
- id: memoryskills-memory
  config:
    portalURL: https://memoryskills.redbearai.com
    apiKeyEnv: MEMORYSKILLS_API_KEY
    profile: true
    recall: false
    writeMode: batch        # turn | batch | idle
```

| 选项 | 默认 | 说明 |
|---|---|---|
| `portalURL` | `https://memoryskills.redbearai.com` | Portal 根地址 |
| `apiKeyEnv` | `MEMORYSKILLS_API_KEY` | `sk-mem-` key 的凭据引用 |
| `profile` | `true` | 会话首轮加载画像 |
| `recall` | `false` | 每轮自动召回 |
| `searchSwitch` | `express` | 自动召回档位 |
| `write` | `true` | 是否写入 |
| `writeMode` | `batch` | `turn` / `batch` / `idle` |
| `tool` | `true` | 注册 `memory_search` |
| `updateCheck` | `true` | 启动和打开配置页时查询 npm registry；只提示新版本，不自动安装，配置页提供复制更新命令按钮 |

## 开发与验证

源码全部是 TypeScript 6.x，位于 `src/`；dsh Host 适配层和表单框架来自 `@redbearai/dsh-memory-core`。所有 Portal 路由与请求体集中在 `src/services/api.ts`。构建产物在 `lib/`（不提交）：

- `lib/index.js`：Host 半边打成单个 ESM 文件
- `lib/client.js`：浏览器半边打成 dsh 客户端加载器要求的 lazy-CJS bundle
- `lib/types/**/*.d.ts`：两半边的类型声明

```sh
# 在仓库根目录先执行 pnpm install
pnpm build          # 先构建 core，再 tsc 生成 lib/types、esbuild 打出两个 bundle
pnpm typecheck
pnpm test           # 单元测试（内置 mock Portal），不需要 dsh 和真实服务
```

端到端：

```sh
MEMORYSKILLS_API_KEY=sk-mem-... pnpm dsh "帮我记一下我喜欢燕麦拿铁"
```

## 目录

| 路径 | 内容 |
|---|---|
| `src/index.ts` | 服务端插件入口：组装 feature，导出 `name` / `inject` / `Config` / `apply` |
| `src/config.ts` | 配置 schema、volatile 快照 |
| `src/features/` | 召回、写入、工具、更新检查四个功能模块 |
| `src/services/` | Portal 路由与请求构造（`api.ts`）、MCP/REST 客户端、transcript、prompt 渲染 |
| `src/client/` | 网页 Plugins 配置页（打包成 `lib/client.js`） |
| `src/client/locale/` | 配置页文案 JSON，构建时打进 `lib/client.js` |
| `locale/` | dsh 插件元数据（标题、描述），由插件管理器读取 |
| `test/` | 单元测试和 mock Portal |
| `lib/` | 构建产物：`index.js`、`client.js`、`types/`（不提交） |
| `scripts/` | 构建和启动 dsh 的开发脚本 |

## License

Apache-2.0
