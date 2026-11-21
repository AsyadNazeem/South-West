'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Readable } = require('node:stream');
const run = require('node:util').promisify(require('node:child_process').execFile);
const sharp = require('sharp');
const { withUpload, transcode, MB } = require('../warranty/media');
const { eligibility } = require('../warranty/policy');
const { remoteVideo } = require('../warranty/remoteVideo');

test('warranty limits and calendar-month expiry', () => {
    const term = {name:'One month',duration_unit:'Months',duration_value:1};
    assert.equal(eligibility('2024-01-31T12:00:00Z',term,new Date('2024-02-29T12:00:00Z')).allowed,true);
    assert.equal(eligibility('2024-01-31T12:00:00Z',term,new Date('2024-03-01T00:00:00Z')).allowed,false);
    process.env.WARRANTY_UNKNOWN_POLICY='deny';
    assert.equal(eligibility(new Date(),null).allowed,false);
    delete process.env.WARRANTY_UNKNOWN_POLICY;
});
test('bounded multipart ingestion and failure cleanup', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(),'sw-private-fixture-'));
    process.env.WARRANTY_STORAGE=root;
    t.after(()=>fs.rm(root,{recursive:true,force:true}));
    const png = await sharp({create:{width:8,height:8,channels:3,background:'black'}}).png().toBuffer();
    async function upload(parts, options={}) {
        const form = new FormData();
        for (const [name,bytes] of parts) form.append(name,new Blob([bytes],{type:'image/png'}),'fixture.png');
        const request = new Request('http://fixture.invalid',{method:'POST',body:form});
        const buffer = Buffer.from(await request.arrayBuffer());
        async function* interrupted() {
            yield buffer.subarray(0,buffer.length - 60);
            throw Error('fixture connection closed');
        }
        const req = Readable.from(options.interrupt ? interrupted() : options.truncate ? buffer.subarray(0,-20) : buffer);
        req.headers = {'content-type':request.headers.get('content-type'),'content-length':String(options.length || buffer.length)};
        return withUpload(req,async (form,processFiles)=> {
            const files = await processFiles();
            if (options.rollback) throw Error('rollback');
            return files;
        });
    }
    for (const parts of [
        [['photos',png],['photos',Buffer.from('broken')]],
        [['photos',Buffer.alloc(3*MB+1)]],
        Array.from({length:11},()=>['photos',png]),
        [['video',png],['video',png]], [['unexpected',png]]
    ]) {
        await assert.rejects(upload(parts)); assert.deepEqual(await fs.readdir(root),[]);
    }
    await assert.rejects(upload([['photos',png]],{length:65*MB}),/size limit/);
    await assert.rejects(upload([['photos',png]],{truncate:true}),/Incomplete|interrupted|malformed/);
    await assert.rejects(upload([['photos',png]],{interrupt:true}),/Incomplete|interrupted|malformed/);
    await assert.rejects(upload([['photos',png]],{rollback:true}),/rollback/);
    const big = await sharp({create:{width:13000,height:1,channels:3,background:'black'}}).png().toBuffer();
    await assert.rejects(upload([['photos',big]]),/unsupported photo/);
    const bomb = await sharp({create:{width:5100,height:5000,channels:3,background:'white'}}).png().toBuffer();
    await assert.rejects(upload([['photos',bomb]]),/unsupported photo/);
    assert.deepEqual(await fs.readdir(root),[]);
    const files = await upload(Array.from({length:10},()=>['photos',png]));
    assert.equal(files.length,10);
    const m = await sharp(path.join(root,files[0].filename)).metadata();
    assert.equal(m.format,'webp'); assert.equal(m.exif,undefined);
});
test('real probe rejects invalid and long video, encoder generates bounded VP9 WebM',async t=>{
    const ffmpeg = process.env.WARRANTY_FFMPEG || 'ffmpeg';
    try { await run(ffmpeg,['-version']); } catch { return t.skip('FFmpeg unavailable on this host'); }
    const root = await fs.mkdtemp(path.join(os.tmpdir(),'sw-video-fixture-'));
    t.after(()=>fs.rm(root,{recursive:true,force:true}));
    const input = path.join(root,'in.mp4'), target = path.join(root,'out.webm');
    process.env.WARRANTY_VIDEO_ENABLED='true';
    await fs.writeFile(input,'invalid');
    await assert.rejects(transcode(input,target),/Invalid video/);
    async function generate(duration) {
        await run(ffmpeg,['-y','-v','error','-f','lavfi','-i','color=c=red:s=32x32:r=5','-t',String(duration),'-c:v','mpeg4',input]);
    }
    await generate(11); await assert.rejects(transcode(input,target),/10 seconds/);
    await generate(10); assert.equal(await transcode(input,target),10);
    const {stdout} = await run(process.env.WARRANTY_FFPROBE || 'ffprobe',['-v','error','-show_format','-show_streams','-of','json',target]);
    const result=JSON.parse(stdout);
    assert.match(result.format.format_name,/webm/); assert.equal(result.streams[0].codec_name,'vp9');
    process.env.WARRANTY_WORKER_URL='https://worker.invalid/convert'; process.env.WARRANTY_WORKER_TOKEN='x'.repeat(40);
    const blob = await fs.readFile(target);
    const headers={'Content-Type':'video/webm','Content-Length':blob.length,'X-Original-Duration':'10'};
    assert.equal(await remoteVideo(input,path.join(root,'remote.webm'),5*MB,async()=>new Response(blob,{headers})),10);
    await assert.rejects(remoteVideo(input,path.join(root,'bad.webm'),5*MB,async()=>new Response('bad',{headers})),/Invalid worker output/);
});

test('CloudLinux Bash launcher passes filenames as literal arguments and enforces all limits before exec', t => {
    const original = process.env.WARRANTY_MEDIA_LAUNCHER;
    t.after(() => {
        if (original === undefined) delete process.env.WARRANTY_MEDIA_LAUNCHER;
        else process.env.WARRANTY_MEDIA_LAUNCHER = original;
    });
    const { mediaCommand } = require('../warranty/media');
    process.env.WARRANTY_MEDIA_LAUNCHER = 'bash';
    const args = ['-i', 'fixture with spaces.mp4'];
    const [binary, argv] = mediaCommand('ffmpeg', args, 'linux');
    assert.equal(binary, '/bin/bash');
    assert.deepEqual(argv.slice(2), ['warranty-media', 'ffmpeg', ...args]);
    assert.equal(argv[1], 'set -e; ulimit -v 1572864; ulimit -t 25; ulimit -n 128; ulimit -f 65536; exec "$@"');
    process.env.WARRANTY_MEDIA_LAUNCHER = 'unknown';
    assert.throws(() => mediaCommand('ffmpeg', args, 'linux'), /configuration/);
});
