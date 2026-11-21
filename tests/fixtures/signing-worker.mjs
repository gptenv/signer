import {id} from 'ethers';
import {WorkersSigner} from '../../dist/index.js';

export default {
  async fetch(_request, env) {
    const signer = new WorkersSigner(env.DELEGATE_SIGNING_KEY);
    const address = await signer.getAddress();
    const message = 'Workers signer smoke test';
    const domain = {name: 'Workers signer test', version: '1', chainId: 31337};
    const types = {Example: [{name: 'number', type: 'uint256'}]};
    const value = {number: 42};
    const digest = id(message);

    return Response.json({
      address,
      message,
      messageSignature: await signer.signMessage(message),
      domain,
      types,
      value,
      typedSignature: await signer.signTypedData(domain, types, value),
      digest,
      digestSignature: await signer.signDigest(digest),
      transaction: await signer.signTransaction({
        type: 2,
        chainId: 31337,
        nonce: 0,
        to: address,
        value: 0n,
        gasLimit: 21000n,
        maxFeePerGas: 1n,
        maxPriorityFeePerGas: 1n,
      }),
    });
  },
};
