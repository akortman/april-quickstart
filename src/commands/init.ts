/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert';
import { copyToTarget, ensureTarget, executeCommand, loadTemplateDefinition, repoRoot } from '../util';
import { deriveGithubUser, deriveProjectName } from '../util/derive-properties';
import { substituteVariables, variableEnvVarPrefix, variablePrefix } from '../util/variable-subsitution';
import path from 'node:path';
import { PathLike } from 'node:fs';

const initRepo = async (target: PathLike, _repositoryName: any, _options: any) => {
  console.log('init repository at target...');
  //if (options.github) {
  //  await executeCommand(
  //    `gh repo create ${repositoryName} --private  --source=${target} --remote=upstream`,
  //    target,
  //  ).then(console.log);
  //}

  await executeCommand('git init', target.toString()).then(console.log);
  await executeCommand('git add .', target.toString()).then(console.log);
  // TODO: we should check if there are any commits yet in case this is in-place.
  //await executeCommand('git commit -m "feat: initial commit"', target).then(console.log);
};

const initFromDirectory = async (
  template: Awaited<ReturnType<typeof loadTemplateDefinition>>,
  dest: PathLike,
  options: { git?: any; github?: any; force?: any },
) => {
  const { sourceDirectory: source } = template;
  console.log(`from\t${source}\nto\t${dest}\n`);

  ensureTarget(dest, options);
  copyToTarget(source, dest);

  await template.postCopy(dest);

  console.log('substituting variables...');
  const makeVariableEntry = async (name: string, getValue: () => Promise<string | undefined>) => ({
    name: `${variablePrefix}_${name}`,
    value: process.env[`${variableEnvVarPrefix}_${name}`] || (await getValue()),
  });

  const repositoryNameVariable = await makeVariableEntry('PROJECT_NAME', () => deriveProjectName(dest));
  await substituteVariables(
    dest,
    await Promise.all([
      repositoryNameVariable,
      makeVariableEntry('GITHUB_USER', deriveGithubUser),
      makeVariableEntry('PROJECT_DESCRIPTION', async () => ''),
    ]),
  );

  if (options.git || options.github) {
    try {
      initRepo(dest, repositoryNameVariable.value, options);
    } catch (e) {
      console.error(`Failed to create repository: ${e}`);
    }
  }
};

/**
 * Given a template string description, try and locate the template file(s).
 * @param templateArg
 */
const findTemplateDirectory = async (templateArg: string): Promise<PathLike> => {
  return path.resolve(`${await repoRoot()}/templates/${templateArg}`);
};

export const initProject = async (
  template: string,
  dest: string,
  options: { git?: any; github?: any; force?: any },
) => {
  const templateDefinition = await loadTemplateDefinition(await findTemplateDirectory(template));
  const destPath = path.resolve(dest);
  console.log(destPath);
  assert(destPath.length > 1);
  initFromDirectory(templateDefinition, dest, options);
};
