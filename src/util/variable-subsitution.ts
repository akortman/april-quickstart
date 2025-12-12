/* eslint-disable @typescript-eslint/no-explicit-any */

import { readFile, writeFile } from 'node:fs/promises';
import { executeCommand } from './execute-command';

export const variablePrefix = '__TODO';
export const variableEnvVarPrefix = 'APRIL_QUICKSTART';

// substitute variables in the target dir.
export const substituteVariables = async (
  target: any,
  variables: [{ name: string; value: any }, { name: string; value: any }, { name: string; value: any }],
) => {
  const files = await executeCommand(`find ${target} -type f -name "*" ! -path '*/.git/*'`).then((stdout: string) =>
    stdout ? stdout.trim().split('\n') : [],
  );

  for (const v of variables) {
    if (v.value === undefined || v.value === null) {
      console.warn(`will skip variable '${v.name}'`);
      continue;
    }
    if (v.value === '') console.warn(`variable '${v.name}' has empty value, proceeding`);
    console.log(`set variable '${v.name}' => '${v.value}'`);
  }

  for (const f of files) {
    let fileText = await readFile(f).then((b) => b.toString());
    for (const v of variables) {
      if (v.value === undefined || v.value === null) {
        continue;
      }
      fileText = fileText.replaceAll(v.name, v.value);
    }
    await writeFile(f, fileText);
  }

  // alert if any variables are still present
  try {
    const unsubstitutedVariables = (await executeCommand(`{ grep -r '${variablePrefix}' ${target} || true; }`)).trim();
    console.log(unsubstitutedVariables);
    if (unsubstitutedVariables) {
      console.warn(
        `The following lines have variables that were not substituted:\n${unsubstitutedVariables
          .split('\n')
          .map((s) => `\t${s}`)
          .join('\n')}`,
      );
    }
  } catch (e) {
    console.error(`Error checking unsubstituted variables: '${e}'`);
  }
};
