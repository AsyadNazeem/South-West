'use strict';

const fs = require('node:fs');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { check, ClaimError } = require('./policy');

// The configured private worker is trusted to probe the original and validate the output.
async function remoteVideo(source, target, maxOutput, fetchImpl = fetch, signal) {
    const url = new URL(process.env.WARRANTY_WORKER_URL);
    const token = process.env.WARRANTY_WORKER_TOKEN;
    check(url.protocol === 'https:' && !url.username && !url.password && token?.length >= 32,
        'Video worker configuration is invalid.', 503);
    const input = fs.createReadStream(source);
    try {
        const response = await fetchImpl(url, { method: 'POST', redirect: 'error', duplex: 'half',
            signal: AbortSignal.any([AbortSignal.timeout(65000), ...(signal ? [signal] : [])]), body: input, headers: { Authorization: 'Bearer ' + token,
                'Content-Type': 'application/octet-stream', 'Content-Length': String((await fs.promises.stat(source)).size) } });
        if (!response.ok) {
            await response.body?.cancel();
            throw new ClaimError(response.status === 400 ? 400 : 503,
                response.status === 400 ? 'Invalid video or duration.' : 'Video worker is unavailable.');
        }
        const duration = Number(response.headers.get('x-original-duration'));
        const length = Number(response.headers.get('content-length'));
        if (!(duration > 0 && duration <= 10 && length > 0 && length <= maxOutput &&
            response.headers.get('content-type') === 'video/webm')) {
            await response.body?.cancel();
            throw new ClaimError(503, 'Invalid worker response.');
        }
        let bytes = 0;
        const bound = new Transform({ transform(chunk, enc, cb) {
            bytes += chunk.length;
            cb(bytes > length ? new Error('size') : null, chunk);
        } });
        await pipeline(response.body, bound, fs.createWriteStream(target, { flags: 'wx', mode: 0o600 }));
        const file = await fs.promises.open(target,'r');
        try {
            const signature = Buffer.alloc(4);
            await file.read(signature,0,4,0);
            check(bytes === length && signature.toString('hex') === '1a45dfa3', 'Invalid worker output.', 503);
        } finally { await file.close(); }
        return duration;
    } catch (error) {
        if (error instanceof ClaimError) throw error;
        throw new ClaimError(503, 'Video worker is unavailable.');
    } finally { input.destroy(); }
}
module.exports = { remoteVideo };
