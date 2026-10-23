# @redbear/dsh-memory-core

Internal shared package for the two MemoryBear dsh plugins. It is not a dsh
plugin itself and should not be installed directly.

## What it contains

Host entry (`@redbear/dsh-memory-core`):

- structural Cordis/dsh host types
- credential resolution
- message helpers (text extraction, human/plugin messages, attachments)
- the `defineTool` helper used instead of importing `@deepseek-ai/dsh-tools`
- `buildApiUrl` / `normalizeBaseUrl` for the plugin route tables

Client entry (`@redbear/dsh-memory-core/client`):

- structural types for dsh web client services (`configForms`, `credentials`, `slots`, `locale`, `remote`)
- generic config-form field schema, parsing and formatting
- the generic `ConfigController` shared by both Plugins pages
- `fill` placeholder helper

Each plugin keeps its own route paths, HTTP transport, config schema, page
components and locale copy; the shared layer only owns the mechanics both
packages need identically.

## Build

```sh
pnpm --filter @redbear/dsh-memory-core run build
```

Produces `lib/index.js`, `lib/client.js` and `lib/types/**/*.d.ts`.

## License

Apache-2.0
