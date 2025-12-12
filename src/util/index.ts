import { loadTemplateDefinition } from './template-loader';
import { executeCommand } from './execute-command';
import { strict as assert } from 'node:assert';
import { substituteVariables } from './variable-subsitution';
import { readdir } from 'fs/promises';
import fs from 'node:fs';
import { access, cp, mkdir } from 'node:fs/promises';
import logger from '../logger';
import path from 'node:path';

export { executeCommand, loadTemplateDefinition, substituteVariables };

/**
 * Get the root directory of the current repository.
 */
export const repoRoot = async () => {
  const s = (await executeCommand('git rev-parse --show-toplevel')).trim();
  assert(s && s.length > 0, 'Expected to be in a git repo to search to templates');
  return s;
};

/**
 * Sourced from https://stackoverflow.com/questions/39217271/how-to-determine-whether-the-directory-is-empty-directory-with-nodejs
 */
export const directoryIsEmpty = async (dir: fs.PathLike) => {
  return readdir(dir).then((files) => {
    return files.length === 0;
  });
};

export const copyToTarget = (source: fs.PathLike, dest: fs.PathLike) => {
  const l = logger.child({ source, dest, function: 'copyToTarget' });
  if (!path.isAbsolute(source.toString())) {
    l.error('Copy failed: source must be absolute');
    return;
  }
  if (!path.isAbsolute(dest.toString())) {
    l.error('Copy failed: dest must be absolute');
    return;
  }
  l.info('copying to target');
  if (fs.existsSync(source)) {
    cp(source.toString(), dest.toString(), { recursive: true });
  } else {
    l.warn('Copy failed: source directory does not exist');
    console.warn(`Attempted to copy from ${source}, but does not seem to exist`);
  }
};

export const ensureTarget = async (dest: fs.PathLike, { force }: { force?: boolean }) => {
  try {
    await access(dest);
    if (!force && !(await directoryIsEmpty(dest)))
      throw new Error(`Non-empty directory at dest: '${dest}', use '--force' to create in a non-empty directory`);
  } catch {
    // directory does not exist, we're okay to proceed.
    console.log('creating directory...');
    await mkdir(dest, { recursive: true });
  }
};
