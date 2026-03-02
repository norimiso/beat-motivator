#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const runDeploy = args.includes('--deploy');

function runNpm(commandArgs) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return run(process.execPath, [npmExecPath, ...commandArgs]);
  }

  return run('npm', commandArgs, { shell: true });
}

function pickCsvPath(argv) {
  for (const arg of argv) {
    if (!arg.startsWith('--')) return arg;
  }
  return '8981-4679_sp_score (1).csv';
}

const csvPath = pickCsvPath(args);

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

console.log('=== Step 1/3: master sync from 30ASA ===');
run(process.execPath, ['tools/sync-master-from-30asa.mjs', '--run-sync']);

console.log('\n=== Step 2/3: CSV strict coverage check ===');
run('node', ['tools/check-csv-coverage.mjs', csvPath, '--strict']);

console.log('\n=== Step 3/3: build ===');
runNpm(['run', 'build']);

if (runDeploy) {
  console.log('\n=== Step 4/4: deploy ===');
  runNpm(['exec', '--', 'wrangler', 'deploy']);
}

console.log('\nDone.');
