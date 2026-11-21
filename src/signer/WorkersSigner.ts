import {
  AbstractSigner,
  BaseWallet,
  isHexString,
  SigningKey,
  type BytesLike,
  type Provider,
  type TransactionRequest,
  type TypedDataDomain,
  type TypedDataField,
} from 'ethers';

/** An offline ethers signer for trusted Worker code. */
export class WorkersSigner extends AbstractSigner {
  readonly #wallet: BaseWallet;

  constructor(secret: string | undefined) {
    super();
    if (typeof secret !== 'string' || !isHexString(secret, 32)) {
      throw new Error('Expected a 0x-prefixed, 32-byte signing secret.');
    }
    try {
      this.#wallet = new BaseWallet(new SigningKey(secret));
    } catch {
      throw new Error('The signing secret is outside the secp256k1 key range.');
    }
  }

  connect(provider: Provider | null = null): WorkersSigner {
    if (provider !== null) {
      throw new Error('WorkersSigner operates offline and cannot be connected to a provider.');
    }
    return this;
  }

  getAddress(): Promise<string> {
    return this.#wallet.getAddress();
  }

  signMessage(message: string | Uint8Array): Promise<string> {
    return this.#wallet.signMessage(message);
  }

  signTransaction(transaction: TransactionRequest): Promise<string> {
    return this.#wallet.signTransaction(transaction);
  }

  signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, unknown>,
  ): Promise<string> {
    return this.#wallet.signTypedData(domain, types, value);
  }

  async signDigest(digest: BytesLike): Promise<string> {
    return this.#wallet.signingKey.sign(digest).serialized;
  }
}
