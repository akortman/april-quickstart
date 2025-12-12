import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { executeCommand } from './execute-command';

export const deriveProjectName = async (target: fs.PathLike) => {
  const pathEntries = target.toString().split('/');
  const projectDirectoryName = pathEntries[pathEntries.length - 1];
  assert(projectDirectoryName.length > 0);
  return projectDirectoryName;
};

export const deriveGithubUser = async () => {
  try {
    const ghUser = (await executeCommand('gh api user -q .login')).trim();
    console.log(`derived github user: '${ghUser}'`);
    return ghUser;
  } catch {
    return undefined;
  }
};
