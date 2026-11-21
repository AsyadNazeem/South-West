'use strict';

// Bind only to loopback. Terminate TLS at the worker's authenticated ingress.
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { transcode, MB } = require('../src/warranty/media');
const { check, ClaimError } = require('../src/warranty/policy');
const token = process.env.WARRANTY_WORKER_TOKEN;
if (!token || token.length < 32 || process.env.WARRANTY_WORKER_URL || process.env.WARRANTY_VIDEO_ENABLED !== 'true') {
    throw Error('Configure a local encoder and a worker token before starting the worker.');
}
const expected = crypto.createHash('sha256').update('Bearer ' + token).digest();
let busy = false;
const server = http.createServer({requestTimeout:60000,headersTimeout:15000}, async (req,res) => {
    const actual = crypto.createHash('sha256').update(req.headers.authorization || '').digest();
    if (!crypto.timingSafeEqual(actual, expected)) { res.writeHead(403).end(); return; }
    if (req.method !== 'POST' || req.url !== '/convert') { res.writeHead(404).end(); return; }
    if (busy) { res.writeHead(429).end(); return; }
    busy = true;
    let dir;
    try {
        const size = Number(req.headers['content-length']);
        const max = Number(process.env.WARRANTY_VIDEO_INPUT_MB || 30);
        check(max > 0 && max <= 64 && Number.isInteger(size) && size > 0 && size <= max * MB,'Invalid size.',413);
        dir = await fs.promises.mkdtemp(path.join(os.tmpdir(),'sw-worker-'));
        const source = path.join(dir,'input'), target = path.join(dir,'result.webm');
        let bytes = 0;
        await pipeline(req,new Transform({transform(chunk,enc,cb) {
            bytes += chunk.length;
            cb(bytes > size ? new Error('size') : null, chunk);
        }}),fs.createWriteStream(source,{flags:'wx',mode:0o600}));
        const duration = await transcode(source,target);
        res.writeHead(200,{'Content-Type':'video/webm','Content-Length':(await fs.promises.stat(target)).size,
            'X-Original-Duration':String(duration),'Cache-Control':'no-store'});
        await pipeline(fs.createReadStream(target),res);
    } catch (e) {
        if (!res.headersSent) res.writeHead(e instanceof ClaimError ? e.status : 503).end();
        else res.destroy();
    } finally { busy=false; if (dir) await fs.promises.rm(dir,{recursive:true,force:true}); }
});
server.listen(Number(process.env.WARRANTY_WORKER_PORT || 8097),'127.0.0.1');
