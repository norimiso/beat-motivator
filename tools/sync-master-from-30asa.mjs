#!/usr/bin/env node

import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

function runNpm(commandArgs, cwd) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return spawnSync(process.execPath, [npmExecPath, ...commandArgs], {
      cwd,
      stdio: 'inherit',
    });
  }

  return spawnSync('npm', commandArgs, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });
}

function getArgValue(flag, fallback) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

const sourceRepo = resolve(getArgValue('--source', '../30ASA_reborn'));
const runSync = args.includes('--run-sync');

const sourceMaster = resolve(sourceRepo, 'seed/master_songs.csv');
const targetMaster = resolve('seed/master_songs.csv');

if (!existsSync(sourceRepo)) {
  console.error(`30ASA repo not found: ${sourceRepo}`);
  process.exit(1);
}

if (runSync) {
  console.log(`Running textage sync in: ${sourceRepo}`);
  const run = runNpm(['run', 'sync:apply'], sourceRepo);

  if (run.status !== 0) {
    if (run.error) {
      console.error(`sync:apply spawn error: ${run.error.message}`);
    }
    if (run.status !== null) {
      console.error(`sync:apply exit status: ${run.status}`);
    }
    if (run.signal) {
      console.error(`sync:apply terminated by signal: ${run.signal}`);
    }
    console.error('sync:apply failed in 30ASA repo');
    process.exit(run.status ?? 1);
  }
}

if (!existsSync(sourceMaster)) {
  console.error(`source master CSV not found: ${sourceMaster}`);
  process.exit(1);
}

cpSync(sourceMaster, targetMaster);

console.log('master_songs.csv copied successfully');
console.log(`from: ${sourceMaster}`);
console.log(`to:   ${targetMaster}`);
