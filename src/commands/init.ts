/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert';
import { copyToTarget, ensureTarget, executeCommand, loadTemplateDefinition, repoRoot } from '../util';
import { deriveGithubUser, deriveProjectName } from '../util/derive-properties';
import { substituteVariables, variableEnvVarPrefix, variablePrefix } from '../util/variable-subsitution';
import path from 'node:path';
import { PathLike } from 'node:fs';
import logger from '../logger';
import { TemplateDefinition } from '../util/template-loader';

const initRepositoryAtTarget = async (target: PathLike, _repositoryName: any, _options: any) => {
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

const initProjectFromTemplateDefinition = async (
  template: TemplateDefinition,
  dest: PathLike,
  options: { git?: any; github?: any; force?: any },
) => {
  logger.info({
    sourceDirectory: template.sourceDirectory,
    dest,
    function: 'initProjectFromTemplateDefinition',
  });

  ensureTarget(dest, options);
  for (const [i, step] of Object.entries(template.steps)) {
    if ('copy' in step) {
      copyToTarget(step.copy.from, dest);
    } else if ('run' in step) {
      const script = step.run.join(' && ');
      const stdout = await executeCommand(script, dest);
      console.log(
        stdout
          .split('\n')
          .map((l) => `run(${i})$ ${l}`)
          .join('\n'),
      );
      return { stdout };
    } else {
      throw new Error(`Unknown step config: ${JSON.stringify(step)}`);
    }
  }

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
      initRepositoryAtTarget(dest, repositoryNameVariable.value, options);
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
  logger.info({ destPath, templateDefinition });
  assert(destPath.length > 1, `${destPath} is not a valid path`);
  initProjectFromTemplateDefinition(templateDefinition, dest, options);
};
