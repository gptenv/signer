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

test('signs Ethereum payloads in a Worker without a provider', async () => {
  const fixture = fileURLToPath(new URL('./fixtures/signing-worker.mjs', import.meta.url));
  const {outputFiles} = await build({
    entryPoints: [fixture],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    conditions: ['workerd', 'worker', 'browser'],
    write: false,
  });
  const disposableWallet = Wallet.createRandom();
  const worker = new Miniflare({
    compatibilityDate: '2026-07-30',
    modules: true,
    script: outputFiles[0].text,
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
