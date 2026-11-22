'use strict';

const fs = require('node:fs');
const { pipeline } = require('node:stream/promises');
const archiver = require('archiver');
const { auditClaim } = require('./audit');
const { sequelize, WarrantyEvidence } = require('../models');
const { location, MB } = require('./media');
const { check, id } = require('./policy');
const { getClaim, event } = require('./claims');
let archives = 0;

async function file(req, res) {
    const claim = await getClaim(req);
    const evidence = await WarrantyEvidence.findOne({ where: { id: id(req.params.file), claim_id: claim.id } });
    check(evidence, 'Evidence not found.', 404);
    const local = location(evidence.filename);
    await fs.promises.access(local, fs.constants.R_OK);
    if (req.query.thumbnail !== '1') {
        await sequelize.transaction(async transaction => {
            await event(claim, req, transaction, 'Evidence accessed', claim.status, null, 'File ' + evidence.id);
            if (req.user) await auditClaim(claim, req.query.preview === '1' ? 'EVIDENCE_PREVIEWED' : 'EVIDENCE_DOWNLOADED', { req, transaction,
                after: { evidence_id: evidence.id, transfer_state: 'authorized' } });
        });
    }
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Type': evidence.mime, 'Content-Disposition': 'attachment; filename="' + evidence.filename + '"' });
    await pipeline(fs.createReadStream(local), res);
}
async function zip(req, res) {
    check(archives < 2, 'Archive service is busy.', 429);
    archives++;
    let timer, archive;
    try {
        const c = await getClaim(req);
        const files = await WarrantyEvidence.findAll({ where: { claim_id: c.id }, order: [['id','ASC']], limit: 81 });
        check(files.length <= 80, 'Archive exceeds file limit.', 413);
        const manifest = [];
        let total = 0;
        for (const e of files) {
            const size = (await fs.promises.stat(location(e.filename))).size;
            total += size;
            check(size === e.bytes && total <= 100 * MB, 'Archive size limit exceeded.', 413);
            manifest.push({ path: (e.request_id ? 'request-' + id(e.request_id) : 'initial') + '/' + e.filename,
                bytes: size, mime: e.mime, uploaded: e.created_at });
        }
        await sequelize.transaction(async transaction => {
            await event(c, req, transaction, 'Archive downloaded', c.status, null, files.length + ' files');
            await auditClaim(c, 'ZIP_DOWNLOADED', { req, transaction,
                after: { file_count: files.length, transfer_state: 'authorized' } });
        });
        archive = archiver('zip', { store: true });
        archive.on('warning', err => archive.destroy(err));
        const abort = () => { archive.abort(); archive.destroy(new Error('Archive interrupted')); };
        timer = setTimeout(abort, 60000);
        res.attachment('warranty-' + id(c.id) + '.zip').set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        const streamed = pipeline(archive, res);
        archive.append(JSON.stringify({ claim: c.reference, order: c.order_number, product: c.product,
            status: c.status, files: manifest }, null, 2), { name: 'manifest.json' });
        files.forEach((e,i) => archive.file(location(e.filename), { name: manifest[i].path }));
        archive.finalize().catch(err => archive.destroy(err));
        await streamed;
    } finally { clearTimeout(timer); archive?.abort(); archives--; }
}
module.exports = { file, zip };
