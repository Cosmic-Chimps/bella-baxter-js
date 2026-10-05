// #1050 (b) — once the SDK has presented its E2EE key, a secrets answer that is not a decryptable envelope
// is refused (apps/sdk/SDK_CONTRACT.md, "Rule: a presented key requires an envelope").
//
// A real local HTTP server plays a misbehaving Bella: it answers getAllSecrets with a genuine envelope to
// the presented key, the plain secrets, a tampered envelope, or an envelope to another key. Runs against the
// BUILT package (dist/), i.e. exactly what ships: `pnpm --filter @bella-baxter/sdk test`.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  BaxterClient,
  E2EE_DECRYPTION_FAILED,
  E2EE_PLAINTEXT_RESPONSE,
  E2EEResponseError,
  requiresEnvelope,
} from '../dist/index.js';

const PROJECT = 'contract-project';
const ENV = 'contract-env';
const SENTINEL = 'the-sentinel-must-never-reach-the-caller';
const SECRETS_PATH = `/api/v1/projects/${PROJECT}/environments/${ENV}/secrets`;

// The server side of the E2EE contract, as in apps/sdk/contract-tests/stub/server.mjs.
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

const plainSecrets = () => ({
  environmentSlug: ENV,
  environmentName: ENV,
  secrets: { SENTINEL_KEY: SENTINEL },
  version: 7,
  lastModified: '2026-10-04T00:00:00Z',
});

// What the server answers to the secrets read; set per test.
let scenario = 'valid';
let presented = [];

const answers = {
  valid: (key) => [200, 'application/json', JSON.stringify(encryptFor(key, JSON.stringify(plainSecrets())))],
  plaintext: () => [200, 'application/json', JSON.stringify(plainSecrets())],
  'plaintext-dotenv': () => [200, 'text/plain', `SENTINEL_KEY=${SENTINEL}\n`],
  'encrypted-false': () => [200, 'application/json', JSON.stringify({ encrypted: false, ...plainSecrets() })],
  tampered: (key) => {
    const envelope = encryptFor(key, JSON.stringify(plainSecrets()));
    const bytes = Buffer.from(envelope.ciphertext, 'base64');
    bytes[0] ^= 0x01;
    return [200, 'application/json', JSON.stringify({ ...envelope, ciphertext: bytes.toString('base64') })];
  },
  'wrong-key': () => {
    const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const other = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    return [200, 'application/json', JSON.stringify(encryptFor(other, JSON.stringify(plainSecrets())))];
  },
  'missing-field': (key) => {
    const { tag: _tag, ...envelope } = encryptFor(key, JSON.stringify(plainSecrets()));
    return [200, 'application/json', JSON.stringify(envelope)];
  },
  forbidden: () => [403, 'application/problem+json', JSON.stringify({ title: 'device not registered', secret: SENTINEL })],
};

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
    presented.push({ path: url.pathname, key });
    let status, type, body;
    if (req.method === 'GET' && url.pathname === SECRETS_PATH) {
      [status, type, body] = answers[scenario](key);
    } else if (req.method === 'GET' && url.pathname === `${SECRETS_PATH}/version`) {
      // Not an envelope-required read: always plain JSON, key or no key.
      [status, type, body] = [200, 'application/json', JSON.stringify({ environmentSlug: ENV, version: 7, lastModified: '2026-10-04T00:00:00Z' })];
    } else {
      [status, type, body] = [404, 'application/json', '{}'];
    }
    res.writeHead(status, { 'content-type': type });
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
  presented = [];
});

async function client() {
  return new BaxterClient({ baxterUrl: baseUrl, accessToken: 'test-token' }).init();
}

async function assertRefused(name, code) {
  scenario = name;
  const c = await client();
  let thrown;
  try {
    const resp = await c.getAllSecrets(PROJECT, ENV);
    assert.fail(`accepted the '${name}' answer: ${JSON.stringify(resp)}`);
  } catch (err) {
    thrown = err;
  }
  assert.ok(thrown instanceof E2EEResponseError, `expected E2EEResponseError, got ${thrown}`);
  assert.equal(thrown.code, code);
  assert.equal(thrown.path, SECRETS_PATH);
  assert.ok(thrown.message.includes(`(${code})`), thrown.message);
  assert.ok(!thrown.message.includes(SENTINEL), 'the refusal must not carry the plaintext');
  // It was refused AFTER presenting the key — the precondition of the rule.
  assert.equal(presented.length, 1);
  assert.ok(presented[0].key, 'the key was presented');
  return thrown;
}

describe('getAllSecrets after presenting the E2EE key (#1050 b)', () => {
  it('(1) decrypts a genuine envelope to the presented key', async () => {
    scenario = 'valid';
    const resp = await (await client()).getAllSecrets(PROJECT, ENV);
    assert.equal(resp.secrets.SENTINEL_KEY, SENTINEL);
    assert.equal(resp.version, 7);
    assert.ok(presented[0].key);
  });

  it('(2) refuses plain secrets JSON with e2ee-plaintext-response', async () => {
    const err = await assertRefused('plaintext', E2EE_PLAINTEXT_RESPONSE);
    assert.equal(err.message, `E2EE response expected but plaintext received for ${SECRETS_PATH}; refusing it (e2ee-plaintext-response)`);
  });

  it('(2b) refuses a non-JSON body (a dotenv file) with e2ee-plaintext-response', async () => {
    await assertRefused('plaintext-dotenv', E2EE_PLAINTEXT_RESPONSE);
  });

  it('(2c) refuses "encrypted": false with e2ee-plaintext-response', async () => {
    await assertRefused('encrypted-false', E2EE_PLAINTEXT_RESPONSE);
  });

  it('(3) refuses a tampered envelope with e2ee-decryption-failed', async () => {
    const err = await assertRefused('tampered', E2EE_DECRYPTION_FAILED);
    assert.equal(err.message, `E2EE response could not be decrypted for ${SECRETS_PATH}; refusing it (e2ee-decryption-failed)`);
    assert.ok(err.cause, 'the crypto failure is kept as cause');
  });

  it('(4) refuses an envelope encrypted to another key with e2ee-decryption-failed', async () => {
    await assertRefused('wrong-key', E2EE_DECRYPTION_FAILED);
  });

  it('(4b) refuses an envelope with a missing field with e2ee-decryption-failed', async () => {
    await assertRefused('missing-field', E2EE_DECRYPTION_FAILED);
  });

  it('(5) a read that is not envelope-required still takes plain JSON', async () => {
    const resp = await (await client()).getSecretsVersion(PROJECT, ENV);
    assert.equal(resp.version, 7);
  });

  it('(6) a non-2xx answer is the API error, not an E2EE refusal', async () => {
    scenario = 'forbidden';
    await assert.rejects((async () => (await client()).getAllSecrets(PROJECT, ENV))(), (err) => {
      assert.ok(!(err instanceof E2EEResponseError), `got ${err}`);
      assert.match(err.message, /Bella API error 403/);
      return true;
    });
  });
});

describe('requiresEnvelope — the envelope-required reads (SDK_CONTRACT.md)', () => {
  const p = '/api/v1/projects/p';
  const required = [
    `${p}/secrets`,
    `${p}/environments/e/secrets`,
    `${p}/environments/e/secrets/export`,
    `${p}/environments/e/providers/v/secrets`,
    `${p}/environments/e/providers/v/secrets/export`,
    `${p}/environments/e/providers/v/secrets/DB_PASSWORD`,
    `${p}/environments/e/providers/v/secrets/DB_PASSWORD/versions/3`,
    `/bella${p}/environments/e/secrets?format=env`,
  ];
  const notRequired = [
    `${p}/environments/e/secrets/version`,
    `${p}/environments/e/secrets/manifest`,
    `${p}/environments/e/secrets/certificates`,
    `${p}/environments/e/providers/v/secrets/hash`,
    `${p}/environments/e/providers/v/secrets/K/metadata`,
    `${p}/environments/e/providers/v/secrets/K/versions`,
    `${p}/environments/e/providers/v/secrets/K/versions/latest`,
    `${p}/environments/e/providers/v/secrets/K/rotation-policy`,
    `${p}/environments/e/providers/v/secrets/import/preview`,
    `${p}/environments/e/totp`,
    '/api/v1/tenants/me/zke',
  ];
  for (const path of required) {
    it(`GET ${path} requires an envelope`, () => assert.equal(requiresEnvelope('GET', path), true));
  }
  for (const path of notRequired) {
    it(`GET ${path} does not`, () => assert.equal(requiresEnvelope('GET', path), false));
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    it(`${method} ${p}/environments/e/secrets does not`, () =>
      assert.equal(requiresEnvelope(method, `${p}/environments/e/secrets`), false));
  }
});
