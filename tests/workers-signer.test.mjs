import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {
  recoverAddress,
  Transaction,
  verifyMessage,
  verifyTypedData,
  Wallet,
} from 'ethers';
import {WorkersSigner} from '../dist/index.js';

test('rejects missing and invalid secrets without echoing them', () => {
  for (const secret of [undefined, 'test-only-invalid-input', `0x${'00'.repeat(32)}`, `0x${'ff'.repeat(32)}`]) {
    assert.throws(() => new WorkersSigner(secret), error => {
      assert.match(error.message, /signing secret/);
      if (secret) assert.ok(!error.message.includes(secret));
      return true;
    });
  }
});

async function bundle(path) {
  const {outputFiles} = await build({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    conditions: ['workerd', 'worker', 'browser'],
    external: ['cloudflare:workers'],
    write: false,
  });
  return outputFiles[0].text;
}

test('signs synthetic Ethereum payloads with a disposable key in workerd', async () => {
  const disposableWallet = Wallet.createRandom();
  const worker = new Miniflare({
    compatibilityDate: '2026-07-30',
    modules: true,
    script: await bundle('./fixtures/signing-worker.mjs'),
    bindings: {DELEGATE_SIGNING_KEY: disposableWallet.privateKey},
  });

  try {
    const response = await worker.dispatchFetch('https://signer.test/');
    assert.equal(response.status, 200);
    const signed = await response.json();
    assert.equal(signed.address, disposableWallet.address);
    assert.equal(verifyMessage(signed.message, signed.messageSignature), signed.address);
    assert.equal(verifyTypedData(signed.domain, signed.types, signed.value, signed.typedSignature), signed.address);
    assert.equal(recoverAddress(signed.digest, signed.digestSignature), signed.address);
    const transaction = Transaction.from(signed.transaction);
    assert.equal(transaction.from, signed.address);
    assert.equal(transaction.to, signed.address);
    assert.equal(transaction.chainId, 31337n);
    assert.equal(transaction.value, 0n);

  } finally {
    await worker.dispose();
  }
});

test('production only exposes private disabled status', async () => {
  const moduleOptions = {modules: true, compatibilityDate: '2026-07-30'};
  const worker = new Miniflare({workers: [
    {
      ...moduleOptions,
      name: 'caller',
      serviceBindings: {SIGNER: {name: 'signer', entrypoint: 'SignerService'}},
      script: `export default {
        async fetch(_request, {SIGNER}) {
          const status = await SIGNER.status();
          try {
            await SIGNER.signDigest('untrusted payload');
            return Response.json({status, rejected: false});
          } catch {
            return Response.json({status, rejected: true});
          }
        }
      };`,
    },
    {...moduleOptions, name: 'signer', script: await bundle('../worker/signer.ts')},
  ]});

  try {
    const response = await worker.dispatchFetch('https://signer.test/');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {status: {signingEnabled: false}, rejected: true});
    const signer = await worker.getWorker('signer');
    const http = await signer.fetch('https://signer.test/sign', {method: 'POST'});
    assert.equal(http.status, 404);
  } finally {
    await worker.dispose();
  }
});
