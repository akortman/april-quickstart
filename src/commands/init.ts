/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert';
import { copyToTarget, ensureTarget, executeCommand, loadTemplateDefinition } from '../util';
import { deriveGithubUser, deriveProjectName } from '../util/derive-properties';
import { substituteVariables, variableEnvVarPrefix, variablePrefix } from '../util/variable-subsitution';
import path from 'node:path';
import { PathLike } from 'node:fs';
import logger from '../logger';
import { LoadedTemplateDefinition } from '../util/template-loader';
import pino from 'pino';

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
  template: LoadedTemplateDefinition,
  dest: PathLike,
  { logger }: { logger: pino.Logger },
) => {
  if (template.extends && template.extends.length > 0) {
    for (const parentTemplate of template.extends) {
      initProjectFromTemplateDefinition(parentTemplate, dest, {
        logger: logger.child({ childTemplate: template.canonicalName, currentTemplate: parentTemplate.canonicalName }),
      });
    }
  }

  logger.info({
    sourceDirectory: template.sourceDirectory,
    dest,
    function: 'initProjectFromTemplateDefinition',
  });

  for (const [i, step] of Object.entries(template.steps)) {
    if ('copy' in step) {
      let resolvedSource, resolvedDest;

      if (step.copy.from.trim().startsWith('.')) {
        logger.debug('copy.from is a local reference to something within the source');
        resolvedSource = path.resolve(template.sourceDirectory + '/' + step.copy.from);
      } else {
        throw new Error(`'copy.from' must be relative to the source directory`);
      }

      if (!step.copy.to) {
        resolvedDest = path.resolve(dest.toString());
      } else if (step.copy.to.trim().startsWith('.')) {
        logger.debug('copy.to is a local reference to something within the source');
        resolvedDest = path.resolve(dest + '/' + step.copy.to);
      } else {
        throw new Error(`'copy.to' must be relative to the source directory`);
      }

      copyToTarget(resolvedSource, resolvedDest);
    } else if ('run' in step) {
      const script = step.run.join(' && ');
      const stdout = await executeCommand(script, dest);
      if (stdout) {
        console.log(
          stdout
            .split('\n')
            .map((l) => `run(${i})$ ${l}`)
            .join('\n'),
        );
      } else {
        console.log(`ran: \`${script}\``);
      }
      return { stdout };
    } else {
      throw new Error(`Unknown step config: ${JSON.stringify(step)}`);
    }
  }
};

export const initProject = async (
  template: string,
  dest: string,
  options: { git?: any; github?: any; force?: any },
) => {
  const templateDefinition = await loadTemplateDefinition(template);
  const destPath = path.resolve(dest);
  logger.info({ destPath, templateDefinition });
  assert(destPath.length > 1, `${destPath} is not a valid path`);

  ensureTarget(dest, options);
  initProjectFromTemplateDefinition(templateDefinition, dest, {
    logger: logger.child({ currentTemplate: templateDefinition.canonicalName }),
  });

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
