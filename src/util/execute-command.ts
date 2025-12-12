import { exec } from 'node:child_process';
import { PathLike } from 'node:fs';
import logger from '../logger';

export const executeCommand = async (command: string, cwd?: string | PathLike) => {
  logger.info(
    {
      directory: cwd,
      command,
    },
    'executeCommand',
  );
  return new Promise<string>((resolve, reject) =>
    // @ts-expect-error "shell: true"
    exec(command, { cwd: cwd, shell: true }, (err: unknown, stdout: string, stderr: string) => {
      if (err) {
        console.error(err);
        reject(stderr);
      }
      resolve(stdout);
    }),
  );
};
