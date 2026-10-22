// Local stand-in for the MemoryBear V1 API, for end-to-end plugin checks.
// Binds 127.0.0.1 only. Logs every request (minus the bearer token) as JSONL.
//   node test/mock-memorybear.mjs [port] [logfile]
import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 18765);
const log = process.argv[3] ?? 'mock-requests.jsonl';
const MEMORY = '用户最喜欢的颜色是靛蓝色；养了一只名叫“团子”的柯基犬。';

const reply = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
};

createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => { chunks.push(chunk); });
    req.on('end', () => {
        const buf = Buffer.concat(chunks);
        const raw = buf.toString('utf8');
        let body = null;
        try { body = JSON.parse(raw || 'null'); } catch { /* keep null */ }
        // Multipart upload: log the part's file name, type and size, not the bytes.
        const multipart = /^multipart\/form-data/.test(req.headers['content-type'] ?? '');
        if (multipart) {
            const head = buf.subarray(0, 2048).toString('latin1');
            const boundary = `--${(req.headers['content-type'].match(/boundary=([^;]+)/) ?? [])[1]}`;
            const start = buf.indexOf('\r\n\r\n') + 4;
            const end = buf.lastIndexOf(Buffer.from(`\r\n${boundary}`));
            body = {
                field: (head.match(/name="([^"]+)"/) ?? [])[1] ?? null,
                filename: Buffer.from((head.match(/filename="([^"]*)"/) ?? [])[1] ?? '', 'latin1').toString('utf8'),
                contentType: (head.match(/Content-Type: ([^\r\n]+)/i) ?? [])[1] ?? null,
                bytes: end > start ? end - start : null,
            };
        }
        appendFileSync(log, `${JSON.stringify({
            time: new Date().toISOString(),
            method: req.method,
            path: req.url,
            hasBearer: /^Bearer \S+/.test(req.headers.authorization ?? ''),
            language: req.headers['x-language-type'] ?? null,
            otherId: req.headers['x-end-user-other-id'] ?? null,
            body,
        })}\n`);
        if (!/^Bearer \S+/.test(req.headers.authorization ?? '')) {
            return reply(res, 401, { code: 1001, msg: 'API Key 不存在', data: {}, error: '' });
        }
        if (req.method === 'POST' && req.url === '/v1/memory/files/upload') {
            if (!multipart || body?.field !== 'file') return reply(res, 422, { code: 422, msg: 'file required', data: {}, error: '' });
            return reply(res, 200, { code: 0, msg: 'File upload successful', data: { file_id: `mock-file-${body.bytes}`, file_key: 'mock' }, error: '' });
        }
        if (req.method === 'POST' && req.url === '/v1/memory/read/sync') {
            if (body?.search_switch === 'meta') {
                return reply(res, 200, { code: 0, msg: 'OK', data: { answer: '<user-info>喜欢柯基的设计师</user-info>', intermediate_outputs: [{ data: { interests: ['柯基', '靛蓝色'], goals: ['学会冲浪'] } }] }, error: '' });
            }
            return reply(res, 200, { code: 0, msg: 'OK', data: { answer: MEMORY, intermediate_outputs: [] }, error: '' });
        }
        const path = (req.url ?? '').split('?')[0];
        if (req.method === 'GET' && path === '/v1/memory/emotion-memory/query_emotion_overview') {
            if (!req.headers['x-timezone']) return reply(res, 422, { code: 422, msg: 'X-Timezone required', data: {}, error: '' });
            return reply(res, 200, { code: 0, msg: 'OK', data: {
                data_quality: 'normal', summary: { dialogue_count: 12, emotion_type_count: 3 },
                conclusion: { type: 'up', title: '情绪回暖', message: '最近一天积极情绪占比上升' },
                items: [{ date: '2026-10-16', dialogue_count: 5, emotions: [{ type: 'joy', display_name: '喜悦', count: 3, percentage: 60 }] }],
            }, error: '' });
        }
        if (req.method === 'GET' && path === '/v1/memory/emotion-memory/query_emotion_timeline') {
            return reply(res, 200, { code: 0, msg: 'OK', data: { items: [
                { date: '2026-10-16', dialogue_count: 5, emotions: [{ type: 'joy', display_name: '喜悦', count: 3, percentage: 60 }, { type: 'anxiety', display_name: '焦虑', count: 2, percentage: 40 }] },
                { date: '2026-10-15', dialogue_count: 7, emotions: [{ type: 'neutral', display_name: '平静', count: 7, percentage: 100 }] },
            ], page: { page: 1, pagesize: 14, total: 2 } }, error: '' });
        }
        if (req.method === 'GET' && path === '/v1/dashboard/end_users') {
            const kw = new URL(req.url, 'http://x').searchParams.get('keyword');
            return reply(res, 200, { code: 0, msg: 'OK', data: { items: [
                { end_user_id: `${kw}-other`, tags: ['别人的'], memory_num: { total: 1, active_count: 1, memory_limit: 5000 } },
                { end_user_id: kw, end_user: { id: kw, other_id: `other-${kw}` }, tags: ['柯基', '冲浪'], memory_num: { total: 42, active_count: 30, memory_limit: 5000 } },
            ], page: { page: 1, pagesize: 10, total: 2, hasnext: false } }, error: '' });
        }
        if (req.method === 'GET' && path === '/v1/memory/analytics/community_graph') {
            return reply(res, 200, { code: 0, msg: 'OK', data: { nodes: [
                { id: 'n1', label: 'ExtractedEntity', properties: { name: '团子' } },
                { id: 'c2', label: 'Community', properties: { community_id: 'small', name: '冲浪计划', summary: '用户想学冲浪', member_count: 2, core_entities: ['冲浪'] } },
                { id: 'c1', label: 'Community', properties: { community_id: 'big', name: '柯基日常', summary: '用户和柯基团子的生活', member_count: 9, core_entities: ['用户', '团子', '靛蓝色项圈', '公园', '狗粮', '兽医', '散步'] } },
            ], edges: [], statistics: { total_nodes: 3 } }, error: '' });
        }
        if (req.method === 'POST' && path === '/v1/memory/preference/recall') {
            const other = req.headers['x-end-user-other-id'] ?? '';
            if (!other.startsWith('other-')) return reply(res, 403, { code: 6010, msg: '无权访问该偏好资源', data: {}, error: '' });
            const preferences = /依赖|安装|install/.test(body?.current_user_message ?? '')
                ? [{ preference_text: '安装 Python 依赖用 uv，不要用 pip', updated_at: '2026-10-20T08:00:00Z' }]
                : [];
            return reply(res, 200, { code: 0, msg: '查询成功', data: { preferences, count: preferences.length }, error: '' });
        }
        if (req.method === 'POST' && path === '/v1/memory/emotion-memory/tags') {
            return reply(res, 200, { code: 0, msg: 'OK', data: { tags: [
                { emotion_type: 'joy', count: 3, percentage: 25, avg_intensity: 0.7 },
                { emotion_type: 'neutral', count: 7, percentage: 58.33, avg_intensity: 0.3 },
                { emotion_type: 'anxiety', count: 2, percentage: 16.67, avg_intensity: 0.6 },
            ], total_count: 12, time_range: null }, error: '' });
        }
        if (req.method === 'POST' && req.url === '/v1/memory/write') {
            return reply(res, 200, { code: 0, msg: '已提交 1 个写入任务', data: { task_ids: ['mock-task'] }, error: '' });
        }
        return reply(res, 404, { code: 404, msg: 'not found', data: {}, error: '' });
    });
}).listen(port, '127.0.0.1', () => console.log(`mock MemoryBear on http://127.0.0.1:${port}/v1`));
