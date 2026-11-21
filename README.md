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

## Private Worker and deployment

The deployable `gptenv-signer` Worker exposes only `SignerService.status()` over a private service binding. It reports `signingEnabled: false`. HTTP requests return 404. The configuration disables `workers.dev` and preview URLs and defines no routes. It accepts no signing requests and has no wallet secret binding.

GitHub Actions tests pull requests and pushes to `main`, including merges. The deploy job runs only after tests and a successful build dry run, then checks that the tested commit is still the head of `main`. Configure GitHub before merging or deploying:

- Protect `main`. Require an independent approval and the **Test and validate Worker** check, dismiss stale approvals, and block bypasses and direct pushes.
- Create the `production` environment with the `main` deployment branch, independent required reviewers, self-review disabled, and admin bypass disabled. Enter the verified account ID as the environment variable `SIGNER_CLOUDFLARE_ACCOUNT_ID`. Create `SIGNER_CLOUDFLARE_DEPLOY_TOKEN` as an environment secret using a token restricted to that account and the minimum Workers deployment permissions available. Prefer an individual Worker scope when supported. Set `SIGNER_PRODUCTION_ENABLED` to `true` in that environment after verifying its protections.
- Verify the target Worker name and account before the first deployment. Check the deployment tag against the reviewed main commit and confirm that public routes and preview URLs are disabled.

## Dedicated delegate design

Wallet authorization and the policy below require a separate reviewed change. The offline `WorkersSigner` is a cryptographic primitive; it does not decide what is authorized.

- The wallet owner keeps the root key and authorizes a dedicated, revocable, non-admin delegate for the specific chains and actions. Scope callers with private service bindings. Keep key material separate from deployment credentials and restrict who can change the signing Worker.
- Accept typed action requests and decode or construct the complete calldata. Verify chain, contract, method, asset, recipient, value, fee bounds, and expiry against an explicit allowlist. Reject unknown operations, opaque digests, arbitrary messages, and unbounded approvals. Use per-action and cumulative spending limits, including fees, and enforce equivalent limits on-chain where supported.
- Reserve the chain/account nonce and the request's replay identifier durably in a single serialized operation before signing. Bind the reservation to the canonical request hash and policy version. Treat retries as idempotent, reconcile confirmed results and expired reservations, and preserve the spend and replay ledger across restarts. A signing error or ambiguous submission must not silently release a commitment.
- Use short-lived delegation and defined expiry for authorizations. Provide a fail-closed emergency stop, on-chain revocation by the wallet owner, and key rotation. Audit decisions without logging keys or raw signing payloads. Verify revocation and recovery in isolation before assigning any funded authority.
