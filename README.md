# gptenv Workers Signer

An offline Ethereum signer for trusted code running in Cloudflare Workers. The package uses ethers for secp256k1 signing and a standard Worker Secret for the signing key. It needs no external signing service, database, RPC connection, or Node.js compatibility flag.

## Use from a Worker

Install this repository at a pinned Git revision, or build and install the output of `npm pack`. For a Git dependency, the `prepare` script builds the package. The host Worker supplies a standard secret binding named `DELEGATE_SIGNING_KEY` containing a `0x`-prefixed, 32-byte secp256k1 key for a dedicated, separately provisioned delegate.

```ts
import {WorkersSigner} from '@gptenv/signer';

const signer = new WorkersSigner(env.DELEGATE_SIGNING_KEY);
const address = await signer.getAddress();
```

The signer exposes `signMessage`, `signTypedData`, `signTransaction`, and `signDigest`, in addition to `getAddress`. The signing methods return a signature or a serialized signed transaction. The signer does not connect to an RPC provider or broadcast transactions. Replace the upstream backend constructor with `new WorkersSigner(env.DELEGATE_SIGNING_KEY)`. The old AWS-specific classes and helpers have been removed.

## Signing authority

Worker code can read its own secret bindings. Keep the signing module in a trusted Worker and restrict who can change that Worker or its bindings. Use a dedicated key, never your wallet's existing private key or recovery phrase. Creating a `WorkersSigner` does not grant any authority over another address. For smart-wallet delegation, the wallet owner must separately configure and authorize the intended restrictions.

The module signs inputs it is called with. Apply authorization to the chain, target, method, amount, and expiry before passing a request to it. Keep generic message and digest signing out of externally callable handlers. Do not put signing secrets in configuration, logs, Git, or `vars`. Worker execution is subject to your normal Workers usage limits and pricing.

## Build and test

Use Node.js 22 or newer.

```sh
npm ci
npm run typecheck
npm test
```

Tests run in a local `workerd` instance through Miniflare with a generated disposable key. They recover the signer from each signature type and decode a synthetic local-chain transaction. They require no Cloudflare account, funded wallet, blockchain, or external service.
