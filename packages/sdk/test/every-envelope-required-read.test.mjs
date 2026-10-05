// #1162 — the E2EE key is presented on EVERY envelope-required read, not only on getAllSecrets
// (apps/sdk/SDK_CONTRACT.md, "Rule: the key is presented on every envelope-required read").
//
// Before #1162 this SDK presented its key only inside getAllSecrets, so the other six reads that carry
// secret values could not be end-to-end encrypted through it at all. The decision now lives in one place
// in the fetch layer (requiresEnvelope), and BaxterClient.request() reaches any path through it.
//
// A real local HTTP server plays Bella: it encrypts each read's plaintext to the presented key and records
// which key each request carried. Runs against the BUILT package (dist/): `pnpm --filter @bella-baxter/sdk test`.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  BaxterClient,
  E2EE_DECRYPTION_FAILED,
  E2EE_PLAINTEXT_RESPONSE,
  E2EEResponseError,
} from '../dist/index.js';

const P = 'contract-project';
const E = 'contract-env';
const V = 'contract-provider';
const K = 'DB_PASSWORD';
const S = 'the-value-only-the-presented-key-opens';

function encryptFor(clientSpkiB64, plaintext) {
  const clientKey = crypto.createPublicKey({ key: Buffer.from(clientSpkiB64, 'base64'), format: 'der', type: 'spki' });
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const shared = crypto.diffieHellman({ privateKey, publicKey: clientKey });
  const aesKey = Buffer.from(crypto.hkdfSync('sha256', shared, Buffer.alloc(32), Buffer.from('bella-e2ee-v1'), 32));
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    encrypted: true,
    algorithm: 'ECDH-P256-HKDF-SHA256-AES256GCM',
    serverPublicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    nonce: nonce.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

const item = { key: K, value: S, description: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', type: null };

// The seven reads, each with the plaintext the API encrypts for it (SDK_CONTRACT.md table).
const READS = [
  { op: 'getAllEnvironmentSecrets', path: `/api/v1/projects/${P}/environments/${E}/secrets`,
    plaintext: { environmentSlug: E, environmentName: E, secrets: { [K]: S }, version: 3, lastModified: '2026-10-04T00:00:00Z' } },
  { op: 'exportEnvironmentSecrets', path: `/api/v1/projects/${P}/environments/${E}/secrets/export`, query: '?format=json',
    plaintext: { [K]: S } },
  { op: 'listSecrets', path: `/api/v1/projects/${P}/environments/${E}/providers/${V}/secrets`, plaintext: [item] },
  { op: 'exportSecrets', path: `/api/v1/projects/${P}/environments/${E}/providers/${V}/secrets/export`, query: '?format=json',
    plaintext: { [K]: S } },
  { op: 'getSecret', path: `/api/v1/projects/${P}/environments/${E}/providers/${V}/secrets/${K}`, plaintext: item },
  { op: 'getSecretVersion', path: `/api/v1/projects/${P}/environments/${E}/providers/${V}/secrets/${K}/versions/2`, plaintext: item },
  { op: 'listGlobalSecrets', path: `/api/v1/projects/${P}/secrets`,
    plaintext: { projectRef: P, projectSlug: P, globalSecretProviderId: null, secrets: [{ ...item, tags: {}, ignoreInScan: false }] } },
];
const VERSION_PATH = `/api/v1/projects/${P}/environments/${E}/secrets/version`;

let mode = 'envelope'; // or 'plaintext'
let seen = [];
let server;
let baseUrl;
const savedEnv = {};

before(async () => {
  for (const k of ['BELLA_BAXTER_API_KEY', 'BELLA_BAXTER_ACCESS_TOKEN', 'BELLA_BAXTER_PRIVATE_KEY', 'BELLA_BAXTER_URL']) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const key = req.headers['x-e2e-public-key'] ?? null;
    seen.push({ path: url.pathname, search: url.search, key, signature: req.headers['x-bella-signature'] ?? null, timestamp: req.headers['x-bella-timestamp'] ?? null });
    const read = req.method === 'GET' && READS.find((r) => r.path === url.pathname);
    let status = 404;
    let body = '{}';
    if (read) {
      status = 200;
      const plain = JSON.stringify(read.plaintext);
      body = key && mode === 'envelope' ? JSON.stringify(encryptFor(key, plain)) : plain;
    } else if (req.method === 'GET' && url.pathname === VERSION_PATH) {
      status = 200;
      body = JSON.stringify({ environmentSlug: E, version: 3, lastModified: '2026-10-04T00:00:00Z' });
    }
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const [k, v] of Object.entries(savedEnv)) if (v !== undefined) process.env[k] = v;
});

beforeEach(() => {
  mode = 'envelope';
  seen = [];
});

const client = () => new BaxterClient({ baxterUrl: baseUrl, accessToken: 'test-token' }).init();

describe('the key is presented on every envelope-required read (#1162)', () => {
  for (const read of READS) {
    it(`${read.op}: presents the key and hands the decrypted body on unchanged`, async () => {
      const c = await client();
      const body = read.op === 'getAllEnvironmentSecrets'
        ? await c.getAllSecrets(P, E)
        : await c.request(read.path + (read.query ?? ''));
      assert.deepEqual(body, read.plaintext);
      assert.equal(seen.length, 1);
      assert.equal(seen[0].key, c['e2ee'].publicKeyB64, 'the client presented its own public key');
      assert.equal(seen[0].search, read.query ?? '');
    });
  }

  it('listSecrets stays an array and getSecret stays one item (nothing is reshaped)', async () => {
    const c = await client();
    const list = await c.request(READS[2].path);
    assert.ok(Array.isArray(list));
    assert.equal(list[0].value, S);
    const one = await c.request(READS[4].path);
    assert.equal(one.key, K);
    assert.equal(one.value, S);
    assert.equal('secrets' in one, false);
  });

  it('does NOT present the key on /secrets/version, which carries no value', async () => {
    const c = await client();
    const viaTyped = await c.getSecretsVersion(P, E);
    const viaRequest = await c.request(VERSION_PATH);
    assert.equal(viaTyped.version, 3);
    assert.equal(viaRequest.version, 3);
    assert.deepEqual(seen.map((r) => r.key), [null, null]);
  });

  it('request() refuses a plaintext answer to a value read with e2ee-plaintext-response', async () => {
    mode = 'plaintext';
    const c = await client();
    for (const read of READS.slice(1)) {
      await assert.rejects(c.request(read.path + (read.query ?? '')), (err) => {
        assert.ok(err instanceof E2EEResponseError, `${read.op}: got ${err}`);
        assert.equal(err.code, E2EE_PLAINTEXT_RESPONSE);
        assert.equal(err.path, read.path, 'the path in the error carries no query string');
        assert.ok(!err.message.includes(S));
        return true;
      });
    }
    assert.ok(seen.every((r) => r.key), 'each refusal followed a presented key');
  });

  it('request() refuses an envelope to another key with e2ee-decryption-failed', async () => {
    const c = await client();
    const other = await client(); // a different ephemeral key pair
    const realFetch = globalThis.fetch;
    // Re-route the request so the server encrypts to `other`'s key instead of `c`'s.
    globalThis.fetch = (url, init) => realFetch(url, {
      ...init,
      headers: { ...init.headers, 'X-E2E-Public-Key': other['e2ee'].publicKeyB64 },
    });
    try {
      await assert.rejects(c.request(READS[4].path), (err) => {
        assert.ok(err instanceof E2EEResponseError, `got ${err}`);
        assert.equal(err.code, E2EE_DECRYPTION_FAILED);
        return true;
      });
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('request() rejects a relative path', async () => {
    const c = await client();
    await assert.rejects(c.request('api/v1/projects'), /must start with '\/'/);
  });
});

describe('HMAC signing covers the query string of a request() path', () => {
  it('signs the path and the query sorted by name, as BellaAuthenticationProvider does', async () => {
    const signingSecret = 'ab'.repeat(32);
    const apiKey = `bax-${'0'.repeat(32)}-${signingSecret}`;
    const c = await new BaxterClient({ baxterUrl: baseUrl, apiKey }).init();
    await c.request(`${READS[1].path}?z=1&format=json`);
    const { signature, timestamp, search } = seen[0];
    assert.equal(search, '?z=1&format=json');
    const bodyHash = crypto.createHash('sha256').update('').digest('hex');
    const expected = crypto.createHmac('sha256', Buffer.from(signingSecret, 'hex'))
      .update(`GET\n${READS[1].path}\nformat=json&z=1\n${timestamp}\n${bodyHash}`)
      .digest('hex');
    assert.equal(signature, expected);
  });
});
