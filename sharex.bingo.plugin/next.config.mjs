import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const plugin = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
if (!/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(plugin.package) || plugin.package.startsWith('dev.')) throw new Error('Invalid plugin package');

export default (phase) => {
  const development = phase === PHASE_DEVELOPMENT_SERVER;
  const localSdkEntry = resolve(process.cwd(), '../../SharexSDK/src/SharexSDK.js');
  return {
    agentRules: false,
    ...(development ? {} : { output: 'export', basePath: `/SharexApp/${plugin.package.replaceAll('.', '-')}` }),
    ...(development ? { allowedDevOrigins: ['localhost', '127.0.0.1'] } : {}),
    trailingSlash: true,
    images: { unoptimized: true },
    transpilePackages: ['sharex-sdk'],
    webpack(config, { dev }) {
      if (dev && existsSync(localSdkEntry)) {
        config.resolve.alias['sharex-sdk$'] = localSdkEntry;
      }
      return config;
    }
  };
};
