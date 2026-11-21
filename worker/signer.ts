import {WorkerEntrypoint} from 'cloudflare:workers';

export class SignerService extends WorkerEntrypoint {
  status(): {signingEnabled: false} {
    return {signingEnabled: false};
  }
}

export default {
  fetch(): Response {
    return new Response(null, {status: 404});
  },
} satisfies ExportedHandler;
