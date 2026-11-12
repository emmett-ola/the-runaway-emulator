import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PRODUCTION = 'https://runaway.macacloud.com';
const API = 'https://api.vercel.com';
const codeFile = /\.(?:[cm]?js|css)$/i;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Walking the whole artifact includes lazy imports, worker code, and PWA chunks,
// not just the entry script/style tags. Reject links instead of silently omitting.
export async function inventory(dist) {
  const files = new Map();
  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Artifact symlink rejected: ${name}`);
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), `${name}/`);
      else if (entry.isFile()) files.set(name, await readFile(path.join(dir, entry.name)));
      else throw new Error(`Unsupported artifact entry: ${name}`);
    }
  }
  await walk(dist);
  if (!files.has('index.html')) throw new Error('Artifact shell index.html is missing');
  const selected = new Map([...files].filter(([name]) => codeFile.test(name) || /\.html$/i.test(name)));
  if (![...selected.keys()].some(name => /\.[cm]?js$/i.test(name))) throw new Error('Artifact contains no JavaScript');
  for (const [name, bytes] of selected) {
    for (const reference of references(bytes.toString('utf8'))) {
      const url = new URL(reference.startsWith('assets/') ? `/${reference}` : reference, `https://artifact.invalid/${name}`);
      if (url.origin !== 'https://artifact.invalid' || !codeFile.test(url.pathname)) continue;
      const local = decodeURIComponent(url.pathname).replace(/^\//, '');
      if (!files.has(local)) throw new Error(`Missing referenced artifact: ${name} -> ${local}`);
    }
  }
  return selected;
}

export function references(text) {
  // HTML src/href, CSS url/import, static/dynamic module imports, and Vite's
  // quoted preload dependency arrays. Validate references as well as walking so
  // missing chunks cannot disappear from the list of things being compared.
  const found = new Set();
  const patterns = [
    /(?:src|href)\s*=\s*["']([^"']+)["']/gi,
    /\b(?:import|export)\s*(?:\(\s*|[^;\n]*?\bfrom\s*)?["']([^"']+)["']/g,
    /\burl\(\s*["']?([^\s)"']+)/gi,
    /@import\s*["']([^"']+)["']/gi,
    /["']((?:\.{0,2}\/|assets\/)[^"'\s]+\.(?:[cm]?js|css)(?:[?#][^"'\s]*)?)["']/g,
  ];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) found.add(match[1]);
  return found;
}

export async function getBytes(url, fetcher = fetch, token) {
  const headers = { 'cache-control': 'no-cache', 'accept-encoding': 'identity' };
  if (token) {
    if (new URL(url).origin !== API) throw new Error('Authorization is restricted to api.vercel.com');
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetcher(url, {
    redirect: 'error', signal: AbortSignal.timeout(10000), headers,
  });
  if (!response.ok) throw new Error(`Anonymous HTTP ${response.status}: ${url}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 64 * 1024 * 1024) throw new Error(`HTTP body too large: ${url}`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deploymentMetadata(fetcher = fetch, token, expectedSha) {
  let deployment;
  try {
    deployment = JSON.parse((await getBytes(`${API}/v13/deployments/runaway.macacloud.com`, fetcher, token)).toString());
  } catch (error) {
    if (token) throw new Error('Authenticated deployment identity unavailable; failing closed.');
    throw new Error(`Deployment identity unavailable via anonymous HTTP. No known public metadata route exists for this SPA; Vercel API normally requires authentication. Cannot prove deployment ID or aliases; failing closed. ${error.message}`);
  }
  if (expectedSha !== undefined && deployment?.gitSource?.sha !== expectedSha) throw new Error('Deployment gitSource.sha does not match EXPECTED_SHA');
  const id = deployment.id ?? deployment.uid;
  if (typeof id !== 'string' || !/^dpl_[A-Za-z0-9]+$/.test(id)) throw new Error('Missing real deployment ID (request IDs are not deployment IDs)');
  if (typeof deployment.url !== 'string' || !/^[a-zA-Z0-9.-]+\.vercel\.app$/.test(deployment.url)) throw new Error('Missing immutable deployment hostname');
  const aliases = [];
  let cursor = '';
  let complete = false;
  for (let page = 0; page < 10; page++) {
    const suffix = cursor ? `?until=${encodeURIComponent(cursor)}` : '';
    const data = JSON.parse((await getBytes(`${API}/v2/deployments/${id}/aliases${suffix}`, fetcher, token)).toString());
    if (!Array.isArray(data.aliases)) throw new Error('Alias list is unavailable or malformed');
    for (const alias of data.aliases) {
      if (!alias || typeof alias.alias !== 'string') throw new Error('Malformed alias entry');
      aliases.push(alias.alias);
    }
    const next = data.pagination?.next;
    if (next === null || next === undefined) { complete = true; break; }
    if (!['number', 'string'].includes(typeof next) || String(next) === cursor) throw new Error('Invalid alias pagination');
    cursor = String(next);
  }
  if (!complete) throw new Error('Alias pagination limit reached; full alias list not proven');
  if (!aliases.includes('runaway.macacloud.com') || !aliases.some(alias => alias.includes('-git-main-') && alias.endsWith('.vercel.app'))) {
    throw new Error(`Deployment ${id} lacks production and/or -git-main- aliases`);
  }
  return { id, url: deployment.url, aliases };
}

export async function compareFiles(files, origin, fetcher = fetch) {
  for (const [name, expected] of files) {
    const pathname = name === 'index.html' ? '/' : `/${name.split('/').map(encodeURIComponent).join('/')}`;
    const served = await getBytes(`${origin}${pathname}`, fetcher);
    const expectedHash = hash(expected);
    const actualHash = hash(served);
    console.log(`${origin}${pathname} expected=${expectedHash} served=${actualHash}`);
    if (expectedHash !== actualHash) throw new Error(`SHA256 mismatch: ${origin}${pathname}`);
  }
}

export async function verifyAttempt(files, fetcher = fetch, options) {
  // Keep the two-argument helper's strict metadata contract for existing callers.
  // Production passes explicit options: bytes always run, identity needs a token.
  await compareFiles(files, PRODUCTION, fetcher);
  if (options && !options.token) {
    console.log('SKIPPED deployment metadata, ID/aliases and gitSource.sha checks: VERCEL_TOKEN is absent. Production bytes/reachability verified; source identity is not proven.');
    return;
  }
  const token = options?.token;
  const sha = options?.expectedSha;
  if (options && (!sha || !/^[0-9a-f]{40}$/.test(sha))) throw new Error('EXPECTED_SHA must be the exact workflow commit');
  const before = await deploymentMetadata(fetcher, token, sha);
  await compareFiles(files, `https://${before.url}`, fetcher);
  const after = await deploymentMetadata(fetcher, token, sha);
  if (before.id !== after.id) throw new Error('Production deployment changed during verification');
  console.log(`Verified deployment ${after.id}; aliases=${JSON.stringify(after.aliases)}`);
}

export async function main(root = process.argv[2]) {
  if (!root) throw new Error('Expected downloaded build artifact directory');
  const sha = process.env.EXPECTED_SHA;
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) throw new Error('EXPECTED_SHA must be the exact workflow commit');
  if ((await readFile(path.join(root, 'build-sha.txt'), 'utf8')).trim() !== sha) throw new Error('Artifact SHA does not match workflow commit');
  const files = await inventory(path.join(root, 'dist'));
  console.log(`Artifact commit=${sha}; comparing ${files.size} shell/JS/CSS files; deployment identity checks require VERCEL_TOKEN.`);
  const options = { token: process.env.VERCEL_TOKEN, expectedSha: sha };
  const attempts = 10;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { await verifyAttempt(files, fetch, options); return; }
    catch (error) {
      console.error(`Attempt ${attempt}/${attempts}: ${error.message}`);
      if (attempt === attempts) throw new Error(`Production verification exhausted bounded retries: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 20000));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
