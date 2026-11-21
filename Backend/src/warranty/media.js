'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const run = require('node:util').promisify(execFile);
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const busboy = require('busboy');
const sharp = require('sharp');
const { UPLOAD_ROOT } = require('../utils/fileStorage');
const { check, ClaimError } = require('./policy');
const MB = 1024 * 1024;
function limit(name, fallback, ceiling) {
    const value = Number(process.env[name] || fallback);
    check(Number.isInteger(value) && value > 0 && value <= ceiling, 'Invalid media configuration.', 503);
    return value;
}
function storage() {
    if (process.env.NODE_ENV === 'production') {
        check(path.isAbsolute(process.env.WARRANTY_STORAGE || ''), 'Private storage is not configured.', 503);
    }
    const root = path.resolve(process.env.WARRANTY_STORAGE || path.join(__dirname, '../../private/warranty'));
    check(!root.split(path.sep).includes('public_html') && root !== UPLOAD_ROOT && !root.startsWith(UPLOAD_ROOT + path.sep), 'Private storage is unavailable.', 503);
    return root;
}
async function prepareStorage() {
    const root = storage();
    await fsp.mkdir(root, { recursive: true, mode: 0o700 });
    const [real, publicRoot, info] = await Promise.all([
        fsp.realpath(root), fsp.realpath(UPLOAD_ROOT).catch(() => UPLOAD_ROOT), fsp.stat(root)
    ]);
    check(!real.split(path.sep).includes('public_html') && real !== publicRoot &&
        !real.startsWith(publicRoot + path.sep) && (info.mode & 0o077) === 0,
        'Private storage permissions are invalid.', 503);
    return real;
}
function location(filename) {
    check(/^[a-f0-9-]{36}\.(webp|webm)$/.test(filename), 'Invalid evidence identifier.');
    return path.join(storage(), filename);
}
let uploads = 0;
let videos = 0;
async function multipart(req, dir) {
    const videoLimit = limit('WARRANTY_VIDEO_INPUT_MB', 30, 64) * MB;
    const max = 30 * MB + videoLimit + 65536;
    const length = Number(req.headers['content-length']);
    check(Number.isSafeInteger(length) && length > 0, 'Upload length required.', 411);
    check(length <= max, 'Upload exceeds the size limit.', 413);
    let parser;
    try {
        parser = busboy({ headers: req.headers, limits: { files: 11, fields: 5, parts: 17,
            fileSize: Math.max(videoLimit, 3 * MB) + 1, fieldSize: 8000, fieldNameSize: 60 } });
    } catch { throw new ClaimError(400, 'Expected a multipart upload.'); }
    const values = Object.create(null), files = [], writes = [];
    let error, photos = 0, video = 0, bytes = 0;
    const fail = (message, status = 400) => { error ||= new ClaimError(status, message); };
    parser.on('field', (name, value, info) => {
        if (name in values || info.valueTruncated || info.nameTruncated) fail('Invalid upload field.');
        values[name] = value;
    });
    for (const event of ['filesLimit', 'partsLimit', 'fieldsLimit']) parser.on(event, () => fail('Too many upload parts.'));
    parser.on('file', (type, stream, info) => {
        stream.on('error', () => fail('Incomplete file.'));
        if (!['photos', 'video'].includes(type) || (type === 'photos' ? ++photos > 10 : ++video > 1)) {
            fail('Select up to ten photos and one video.'); stream.resume(); return;
        }
        const file = { type, source: path.join(dir, randomUUID()), original_name:
            path.basename(info.filename || 'evidence').replace(/[\x00-\x1f\x7f]/g, '').slice(0, 180) };
        files.push(file);
        let size = 0;
        const bound = new Transform({ transform(chunk, enc, cb) {
            size += chunk.length;
            if (size > (type === 'photos' ? 3 * MB : videoLimit)) fail('Evidence file exceeds the size limit.', 413);
            cb(null, error ? undefined : chunk);
        } });
        stream.on('limit', () => fail('Evidence file exceeds the size limit.', 413));
        writes.push(pipeline(stream, bound, fs.createWriteStream(file.source, { mode: 0o600, flags: 'wx' }))
            .catch(() => fail('Incomplete upload.')));
    });
    const counter = new Transform({ transform(chunk, enc, cb) {
        bytes += chunk.length;
        cb(bytes > max ? new ClaimError(413, 'Upload too large.') : null, chunk);
    } });
    const timer = setTimeout(() => parser.destroy(new Error('timeout')), 120000);
    try { await pipeline(req, counter, parser); }
    catch { fail('Upload interrupted or malformed.'); }
    finally { clearTimeout(timer); await Promise.all(writes); }
    if (error) throw error;
    return { values, files, photos };
}

async function photo(source, target) {
    const handle = await fsp.open(source,'r');
    const header = Buffer.alloc(12);
    try { await handle.read(header,0,12,0); } finally { await handle.close(); }
    check(header.subarray(0,3).equals(Buffer.from([255,216,255])) ||
        header.subarray(0,8).toString('hex') === '89504e470d0a1a0a' ||
        (header.toString('ascii',0,4) === 'RIFF' && header.toString('ascii',8,12) === 'WEBP'),
        'Invalid or unsupported photo.');
    const input = sharp(source, { failOn: 'warning', limitInputPixels: 25000000 });
    try {
        const m = await input.metadata();
        check(['jpeg','png','webp'].includes(m.format) && (m.pages || 1) === 1 &&
            m.width <= 12000 && m.height <= 12000, 'Use a single JPEG, PNG or WebP image.');
        await input.rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 84 }).timeout({ seconds: 12 }).toFile(target);
    } catch { throw new ClaimError(400, 'Invalid, oversized or unsupported photo.'); }
}
const runOptions = { timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 512 * 1024 };
const formats = 'mov,matroska,webm';
function mediaCommand(binary, args, platform = process.platform) {
    if (platform === 'linux') {
        const launcher = process.env.WARRANTY_MEDIA_LAUNCHER || 'prlimit';
        if (launcher === 'bash') {
            // Bash reads a constant program; paths and codec arguments are separate positional parameters.
            return ['/bin/bash', ['-c',
                'set -e; ulimit -v 1572864; ulimit -t 25; ulimit -n 128; ulimit -f 65536; exec "$@"',
                'warranty-media', binary, ...args]];
        }
        check(launcher === 'prlimit', 'Invalid video processor configuration.', 503);
        return [process.env.WARRANTY_PRLIMIT || '/usr/bin/prlimit', [
            '--as=1610612736','--cpu=25','--nofile=128','--fsize=67108864','--',binary,...args
        ]];
    }
    return [binary, args];
}
async function mediaTool(binary,args,signal) {
    const [command, argv] = mediaCommand(binary, args);
    return run(command, argv, { ...runOptions, signal });
}
async function probe(file,signal) {
    const { stdout } = await mediaTool(process.env.WARRANTY_FFPROBE || 'ffprobe',
        ['-v','error','-protocol_whitelist','file','-format_whitelist',formats,'-max_pixels','8294400','-threads','1','-show_format','-show_streams','-of','json',file], signal);
    return JSON.parse(stdout);
}
async function transcode(source, target, signal) {
    check(process.env.WARRANTY_VIDEO_ENABLED === 'true', 'Video processing is unavailable.', 503);
    check(videos < 1, 'Video processor is busy. Please retry.', 429);
    videos++;
    try {
        const max = limit('WARRANTY_VIDEO_OUTPUT_MB', 5, 16) * MB;
        if (process.env.WARRANTY_WORKER_URL) {
            return await require('./remoteVideo').remoteVideo(source, target, max, fetch, signal);
        }
        const m = await probe(source,signal);
        const v = m.streams.find(s => s.codec_type === 'video');
        const declared = Number(m.format.duration);
        check(v && v.width * v.height <= 8294400 && m.streams.length <= 2 &&
            m.streams.every(s => ['video','audio'].includes(s.codec_type) && !(Number(s.duration) > 10)) &&
            (!Number.isFinite(declared) || (declared > 0 && declared <= 10)), 'Use a video of at most 10 seconds.');
        // Check packet timestamps as well as container metadata. Bound probe output and wall time.
        const packets = await mediaTool(process.env.WARRANTY_FFPROBE || 'ffprobe', ['-v','error','-protocol_whitelist','file',
            '-format_whitelist',formats,'-show_entries','packet=pts_time,duration_time','-of','json',source],signal);
        let first = Infinity, last = -Infinity;
        for (const packet of JSON.parse(packets.stdout).packets || []) {
            const time = Number(packet.pts_time);
            check(Number.isFinite(time), 'Invalid video timestamps.');
            first = Math.min(first, time);
            last = Math.max(last, time + (Number(packet.duration_time) || 0));
        }
        check(last - first <= 10.001 && last > first, 'Use a video of at most 10 seconds.');
        const duration = Number.isFinite(declared) ? declared : Math.min(10,last - first);
        await mediaTool(process.env.WARRANTY_FFMPEG || 'ffmpeg', ['-nostdin','-v','error','-xerror','-protocol_whitelist','file',
            '-format_whitelist',formats,'-threads','1','-max_pixels','8294400','-i',source,'-map','0:v:0','-map','0:a:0?',
            '-map_metadata','-1','-map_chapters','-1','-filter_threads','1','-vf',
            'fps=24,scale=640:640:force_original_aspect_ratio=decrease:force_divisible_by=2',
            '-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','6','-threads','1','-b:v','650k',
            '-c:a','libopus','-ac','1','-b:a','48k','-fs',String(max + 1),'-f','webm',target], signal);
        const out = await probe(target,signal);
        const actual = Number(out.format.duration);
        check(actual > 0 && actual <= 10.05 && (await fsp.stat(target)).size <= max, 'Video exceeds output limits.');
        return duration;
    } catch (e) {
        if (e instanceof ClaimError) throw e;
        if (['ENOENT','EACCES',126,127].includes(e.code)) throw new ClaimError(503, 'Video processor is unavailable.');
        throw new ClaimError(400, 'Invalid video or processing limit exceeded.');
    } finally { videos--; }
}
async function withUpload(req, callback) {
    check(uploads < 2, 'Upload service is busy. Please retry.', 429);
    uploads++;
    let dir;
    const stored = [];
    try {
        dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'sw-warranty-'));
        const form = await multipart(req, dir);
        async function processFiles() {
            req.warrantySignal?.throwIfAborted();
            await prepareStorage();
            for (const file of form.files) {
                const image = file.type === 'photos';
                const filename = randomUUID() + (image ? '.webp' : '.webm');
                const temp = path.join(dir, filename);
                let duration = null;
                if (image) await photo(file.source, temp);
                else duration = await transcode(file.source, temp, req.warrantySignal);
                req.warrantySignal?.throwIfAborted();
                const target = location(filename);
                await fsp.chmod(temp, 0o600);
                await fsp.copyFile(temp, target, fs.constants.COPYFILE_EXCL);
                stored.push(target);
                file.record = { filename, duration, original_name: file.original_name,
                    mime: image ? 'image/webp' : 'video/webm', bytes: (await fsp.stat(temp)).size };
            }
            return form.files.map(f => f.record);
        }
        return await callback(form, processFiles);
    } catch (error) {
        await Promise.all(stored.map(f => fsp.rm(f, { force: true })));
        throw error;
    } finally {
        uploads--;
        if (dir) await fsp.rm(dir, { recursive: true, force: true });
    }
}
module.exports = { mediaCommand, prepareStorage, withUpload, location, photo, transcode, MB };
