import {defineConfig, exports} from 'cf/config';

export default defineConfig({
  worker: {
    name: 'gptenv-signer',
    entrypoint: './worker/signer.ts',
    compatibilityDate: '2026-11-21',
    workersDev: false,
    previewUrls: false,
    observability: {
      enabled: true,
      logs: {enabled: true, invocationLogs: false},
      traces: {enabled: true, headSamplingRate: 0.01},
    },
    exports: {SignerService: exports.worker()},
  },
});
