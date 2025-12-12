import { loadTemplateDefinition } from './config-loader';
import { executeCommand } from './execute-command';
import { strict as assert } from 'node:assert';
import { substituteVariables } from './variable-subsitution';
import { readdir } from 'fs/promises';
import fs from 'node:fs';
import { access, cp, mkdir } from 'node:fs/promises';
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
  console.log('copying files to directory...');
  if (fs.existsSync(source + '/files')) cp(path.resolve(source + '/files'), dest.toString(), { recursive: true });
  else console.warn(`Does not exist: ${fs.existsSync(source + '/files')}`);
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
