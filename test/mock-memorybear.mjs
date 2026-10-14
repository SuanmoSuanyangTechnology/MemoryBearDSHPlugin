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
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
        let body = null;
        try { body = JSON.parse(raw || 'null'); } catch { /* keep null */ }
        appendFileSync(log, `${JSON.stringify({
            time: new Date().toISOString(),
            method: req.method,
            path: req.url,
            hasBearer: /^Bearer \S+/.test(req.headers.authorization ?? ''),
            language: req.headers['x-language-type'] ?? null,
            body,
        })}\n`);
        if (!/^Bearer \S+/.test(req.headers.authorization ?? '')) {
            return reply(res, 401, { code: 1001, msg: 'API Key 不存在', data: {}, error: '' });
        }
        if (req.method === 'POST' && req.url === '/v1/memory/read/sync') {
            return reply(res, 200, { code: 0, msg: 'OK', data: { answer: MEMORY, intermediate_outputs: [] }, error: '' });
        }
        if (req.method === 'POST' && req.url === '/v1/memory/write') {
            return reply(res, 200, { code: 0, msg: '已提交 1 个写入任务', data: { task_ids: ['mock-task'] }, error: '' });
        }
        return reply(res, 404, { code: 404, msg: 'not found', data: {}, error: '' });
    });
}).listen(port, '127.0.0.1', () => console.log(`mock MemoryBear on http://127.0.0.1:${port}/v1`));
