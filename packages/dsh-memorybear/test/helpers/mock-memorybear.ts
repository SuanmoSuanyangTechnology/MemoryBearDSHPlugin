/**
 * Local stand-in for the MemoryBear V1 API, for end-to-end plugin checks.
 * Binds 127.0.0.1 only and records every request (minus the bearer token).
 *
 * The test suite starts it in-process; `scripts/mock-memorybear.ts` exposes it
 * as a standalone CLI for the end-to-end flow.
 *
 * @module dsh-memorybear/test/helpers/mock-memorybear
 */
import { appendFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { API_PATHS } from '../../src/services/api.js';

/** One recorded request. */
export interface MockRequest {
    time: string;
    method: string | undefined;
    path: string | undefined;
    hasBearer: boolean;
    language: string | null;
    otherId: string | null;
    body: unknown;
}

export interface MockMemoryBearOptions {
    port?: number;
    /** Append JSONL request records to this file. */
    logFile?: string;
}

export interface MockMemoryBear {
    port: number;
    url: string;
    requests: MockRequest[];
    close(): Promise<void>;
}

const MEMORY = '用户最喜欢的颜色是靛蓝色；养了一只名叫“团子”的柯基犬。';

/** Mock server paths, derived from the production route registry. */
const PATH = {
    uploadFile: `/v1${API_PATHS.uploadFile}`,
    readSync: `/v1${API_PATHS.readSync}`,
    write: `/v1${API_PATHS.write}`,
    endUsers: `/v1${API_PATHS.endUsers}`,
    preferenceRecall: `/v1${API_PATHS.preferenceRecall}`,
    emotionOverview: `/v1${API_PATHS.emotionOverview}`,
    emotionTimeline: `/v1${API_PATHS.emotionTimeline}`,
    communityGraph: `/v1${API_PATHS.communityGraph}`,
} as const;

function reply(res: import('node:http').ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

function parseMultipart(contentType: string, buffer: Buffer): Record<string, unknown> {
    const head = buffer.subarray(0, 2048).toString('latin1');
    const boundary = `--${(contentType.match(/boundary=([^;]+)/) ?? [])[1] ?? ''}`;
    const start = buffer.indexOf('\r\n\r\n') + 4;
    const end = buffer.lastIndexOf(Buffer.from(`\r\n${boundary}`));
    return {
        field: (head.match(/name="([^"]+)"/) ?? [])[1] ?? null,
        filename: Buffer.from((head.match(/filename="([^"]*)"/) ?? [])[1] ?? '', 'latin1').toString('utf8'),
        contentType: (head.match(/Content-Type: ([^\r\n]+)/i) ?? [])[1] ?? null,
        bytes: end > start ? end - start : null,
    };
}

/** Start the mock on an ephemeral port by default. */
export async function startMockMemoryBear(options: MockMemoryBearOptions = {}): Promise<MockMemoryBear> {
    const requests: MockRequest[] = [];
    const server: Server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => { chunks.push(chunk); });
        req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const raw = buffer.toString('utf8');
            let body: Record<string, any> | null = null;
            try {
                body = JSON.parse(raw || 'null') as Record<string, any> | null;
            } catch {
                body = null;
            }
            // Multipart upload: log the part's file name, type and size, not the bytes.
            if (/^multipart\/form-data/.test(req.headers['content-type'] ?? '')) {
                body = parseMultipart(req.headers['content-type'] ?? '', buffer);
            }
            const record: MockRequest = {
                time: new Date().toISOString(),
                method: req.method,
                path: req.url,
                hasBearer: /^Bearer \S+/.test(req.headers.authorization ?? ''),
                language: (req.headers['x-language-type'] as string | undefined) ?? null,
                otherId: (req.headers['x-end-user-other-id'] as string | undefined) ?? null,
                body,
            };
            requests.push(record);
            if (options.logFile) appendFileSync(options.logFile, `${JSON.stringify(record)}\n`);

            if (!record.hasBearer) {
                reply(res, 401, { code: 1001, msg: 'API Key 不存在', data: {}, error: '' });
                return;
            }
            if (req.method === 'POST' && req.url === PATH.uploadFile) {
                const upload = body as { field?: string; bytes?: number } | null;
                if (upload?.field !== 'file') {
                    reply(res, 422, { code: 422, msg: 'file required', data: {}, error: '' });
                    return;
                }
                reply(res, 200, { code: 0, msg: 'File upload successful', data: { file_id: `mock-file-${upload.bytes}`, file_key: 'mock' }, error: '' });
                return;
            }
            if (req.method === 'POST' && req.url === PATH.readSync) {
                if (body?.search_switch === 'meta') {
                    reply(res, 200, {
                        code: 0,
                        msg: 'OK',
                        data: {
                            answer: '<user-info>喜欢柯基的设计师</user-info>',
                            intermediate_outputs: [{ data: { interests: ['柯基', '靛蓝色'], goals: ['学会冲浪'] } }],
                        },
                        error: '',
                    });
                    return;
                }
                reply(res, 200, { code: 0, msg: 'OK', data: { answer: MEMORY, intermediate_outputs: [] }, error: '' });
                return;
            }
            const path = (req.url ?? '').split('?')[0];
            if (req.method === 'GET' && path === PATH.emotionOverview) {
                if (!req.headers['x-timezone']) {
                    reply(res, 422, { code: 422, msg: 'X-Timezone required', data: {}, error: '' });
                    return;
                }
                reply(res, 200, {
                    code: 0,
                    msg: 'OK',
                    data: {
                        data_quality: 'normal',
                        summary: { dialogue_count: 12, emotion_type_count: 3 },
                        conclusion: { type: 'up', title: '情绪回暖', message: '最近一天积极情绪占比上升' },
                        items: [{ date: '2026-10-16', dialogue_count: 5, emotions: [{ type: 'joy', display_name: '喜悦', count: 3, percentage: 60 }] }],
                    },
                    error: '',
                });
                return;
            }
            if (req.method === 'GET' && path === PATH.emotionTimeline) {
                reply(res, 200, {
                    code: 0,
                    msg: 'OK',
                    data: {
                        items: [
                            { date: '2026-10-16', dialogue_count: 5, emotions: [{ type: 'joy', display_name: '喜悦', count: 3, percentage: 60 }, { type: 'anxiety', display_name: '焦虑', count: 2, percentage: 40 }] },
                            { date: '2026-10-15', dialogue_count: 7, emotions: [{ type: 'neutral', display_name: '平静', count: 7, percentage: 100 }] },
                        ],
                        page: { page: 1, pagesize: 14, total: 2 },
                    },
                    error: '',
                });
                return;
            }
            if (req.method === 'GET' && path === PATH.endUsers) {
                const keyword = new URL(req.url ?? '/', 'http://x').searchParams.get('keyword');
                reply(res, 200, {
                    code: 0,
                    msg: 'OK',
                    data: {
                        items: [
                            { end_user_id: `${keyword}-other`, tags: ['别人的'], memory_num: { total: 1, active_count: 1, memory_limit: 5000 } },
                            { end_user_id: keyword, end_user: { id: keyword, other_id: `other-${keyword}` }, tags: ['柯基', '冲浪'], memory_num: { total: 42, active_count: 30, memory_limit: 5000 } },
                        ],
                        page: { page: 1, pagesize: 10, total: 2, hasnext: false },
                    },
                    error: '',
                });
                return;
            }
            if (req.method === 'GET' && path === PATH.communityGraph) {
                reply(res, 200, {
                    code: 0,
                    msg: 'OK',
                    data: {
                        nodes: [
                            { id: 'n1', label: 'ExtractedEntity', properties: { name: '团子' } },
                            { id: 'c2', label: 'Community', properties: { community_id: 'small', name: '冲浪计划', summary: '用户想学冲浪', member_count: 2, core_entities: ['冲浪'] } },
                            { id: 'c1', label: 'Community', properties: { community_id: 'big', name: '柯基日常', summary: '用户和柯基团子的生活', member_count: 9, core_entities: ['用户', '团子', '靛蓝色项圈', '公园', '狗粮', '兽医', '散步'] } },
                        ],
                        edges: [],
                        statistics: { total_nodes: 3 },
                    },
                    error: '',
                });
                return;
            }
            if (req.method === 'POST' && path === PATH.preferenceRecall) {
                const other = (req.headers['x-end-user-other-id'] as string | undefined) ?? '';
                if (!other.startsWith('other-')) {
                    reply(res, 403, { code: 6010, msg: '无权访问该偏好资源', data: {}, error: '' });
                    return;
                }
                const preferences = /依赖|安装|install/.test(body?.current_user_message ?? '')
                    ? [{ preference_text: '安装 Python 依赖用 uv，不要用 pip', updated_at: '2026-10-20T08:00:00Z' }]
                    : [];
                reply(res, 200, { code: 0, msg: '查询成功', data: { preferences, count: preferences.length }, error: '' });
                return;
            }
            if (req.method === 'POST' && req.url === PATH.write) {
                reply(res, 200, { code: 0, msg: '已提交 1 个写入任务', data: { task_ids: ['mock-task'] }, error: '' });
                return;
            }
            reply(res, 404, { code: 404, msg: 'not found', data: {}, error: '' });
        });
    });
    await new Promise<void>((resolve) => server.listen(options.port ?? 0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address !== 'object') throw new Error('mock server did not bind a TCP port');
    return {
        port: address.port,
        url: `http://127.0.0.1:${address.port}/v1`,
        requests,
        close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
}
