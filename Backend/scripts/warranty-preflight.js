'use strict';

// Run as the Passenger application user with the same environment as the web application.
require('dotenv').config();
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { prepareStorage, photo, transcode, MB } = require('../src/warranty/media');

async function checkHost() {
    const storage = await prepareStorage();
    const temp = await fs.mkdtemp(path.join(os.tmpdir(),'sw-warranty-check-'));
    try {
        for (const [label, dir] of [['Temporary storage', temp],['Private storage',storage]]) {
            const disk = await fs.statfs(dir);
            console.log(label, Math.floor(disk.bavail * disk.bsize / MB), 'MiB available');
        }
        const png = path.join(temp,'fixture.png');
        await sharp({create:{width:32,height:32,channels:3,background:'white'}}).png().toFile(png);
        const out = path.join(temp,'fixture.webp');
        await photo(png,out);
        const checkDir = await fs.mkdtemp(path.join(storage,'preflight-'));
        try { await fs.copyFile(out,path.join(checkDir,'fixture.webp')); }
        finally { await fs.rm(checkDir,{recursive:true,force:true}); }
        console.log('Private WebP write passed');
        const fixture = path.join(__dirname,'../src/tests/fixtures/warranty/one-second.mp4');
        await transcode(fixture,path.join(temp,'fixture.webm'));
        console.log('Synthetic MP4 to WebM conversion passed');
    } finally { await fs.rm(temp,{recursive:true,force:true}); }
}
checkHost().catch(error => {
    console.error('Preflight failed',error.status ? error.message : error.code || 'Configuration or media failure');
    process.exitCode=1;
});
