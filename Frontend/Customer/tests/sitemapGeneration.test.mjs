import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const scriptPath = fileURLToPath(new URL('../scripts/generate-sitemap.mjs', import.meta.url))

async function runGenerator(fetchSetup) {
  const directory = await mkdtemp(resolve(tmpdir(), 'southwest-sitemap-'))
  await mkdir(resolve(directory, 'public'))
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `${fetchSetup}\nawait import(${JSON.stringify(scriptPath)})`], {
    cwd: directory,
    env: { ...process.env, VITE_API_URL: 'https://api.southwest.lk' },
    encoding: 'utf8',
  })
  return { directory, result }
}

test('sitemap follows API cursors and writes only unique public product URLs', async () => {
  const payloads = [
    {
      data: [
        { slug: 'public-lamp', public_id: '123e4567-e89b-12d3-a456-426614174000' },
        { slug: 'private-lamp', public_id: '123e4567-e89b-12d3-a456-426614174001', is_active: false },
        { slug: 'bad/slug', public_id: '123e4567-e89b-12d3-a456-426614174002' },
      ],
      pagination: { seed: 'stable-seed', hasMore: true, nextCursor: 'cursor-one' },
    },
    {
      data: [{ slug: 'public-lamp', public_id: '123e4567-e89b-12d3-a456-426614174000' }],
      pagination: { seed: 'stable-seed', hasMore: false, nextCursor: null },
    },
  ]
  const fetchSetup = `
    const payloads = ${JSON.stringify(payloads)};
    const requests = [];
    globalThis.fetch = async url => {
      requests.push(new URL(url));
      return { ok: true, status: 200, json: async () => payloads.shift() };
    };
    process.on('beforeExit', () => {
      if (requests.length !== 2 || requests[0].searchParams.get('paginate') !== '1' || requests[0].searchParams.get('limit') !== '100' || requests[1].searchParams.get('cursor') !== 'cursor-one') process.exitCode = 1;
    });
  `
  const { directory, result } = await runGenerator(fetchSetup)
  try {
    assert.equal(result.status, 0, result.stderr)
    const sitemap = await readFile(resolve(directory, 'public/sitemap.xml'), 'utf8')
    assert.equal((sitemap.match(/public-lamp-123e4567-e89b-12d3-a456-426614174000/g) || []).length, 1)
    assert.doesNotMatch(sitemap, /private-lamp|bad\/slug|undefined/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('sitemap API errors preserve the existing static sitemap', async () => {
  const { directory, result } = await runGenerator(`globalThis.fetch = async () => { throw new Error('offline'); };`)
  try {
    const staticPath = resolve(directory, 'public/sitemap.xml')
    await writeFile(staticPath, '<static-sitemap/>')
    const rerun = spawnSync(process.execPath, ['--input-type=module', '-e', `globalThis.fetch = async () => { throw new Error('offline'); }; await import(${JSON.stringify(scriptPath)})`], {
      cwd: directory,
      env: { ...process.env, VITE_API_URL: 'https://api.southwest.lk' },
      encoding: 'utf8',
    })
    assert.notEqual(rerun.status, 0)
    assert.equal(await readFile(staticPath, 'utf8'), '<static-sitemap/>')
    assert.equal(result.status, 1)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
