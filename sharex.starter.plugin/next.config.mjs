import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';
import { readFileSync } from 'node:fs';

const plugin = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
if (!/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(plugin.package) || plugin.package.startsWith('dev.')) throw new Error('Invalid plugin package');

export default (phase) => {
  const development = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    agentRules: false,
    ...(development ? {} : { output: 'export', basePath: `/SharexApp/${plugin.package.replaceAll('.', '-')}` }),
    trailingSlash: true,
    images: { unoptimized: true },
    transpilePackages: ['sharex-sdk'],
    experimental: { externalDir: true }
  };
};
