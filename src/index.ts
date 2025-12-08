import { Command } from 'commander';
import { readdir, readFile, writeFile, access, mkdir, cp } from 'fs/promises';
import { exec } from 'node:child_process';
import { resolve as _resolve } from 'path';
import { strict as assert } from 'node:assert';
import dotenv from 'dotenv';
import { PathLike } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const variablePrefix = '__TODO';
const variableEnvVarPrefix = 'APRIL_QUICKSTART';

const executeCommand = async (command: string, cwd?: string) => {
  const actualCwd = cwd || dirname(fileURLToPath(import.meta.url));
  return new Promise<string>((resolve, reject) =>
    // @ts-ignore "shell: true"
    exec(command, { cwd: actualCwd, shell: true }, (err: any, stdout: string, stderr: string) => {
      if (err) {
        console.error(err);
        reject(stderr);
      }
      resolve(stdout);
    }),
  );
};

/**
 * Sourced from https://stackoverflow.com/questions/39217271/how-to-determine-whether-the-directory-is-empty-directory-with-nodejs
 */
const directoryIsEmpty = async (dir: PathLike) => {
  return readdir(dir).then((files) => {
    return files.length === 0;
  });
};

// substitute variables in the target dir.
const substituteVariables = async (
  target: any,
  variables: [{ name: string; value: any }, { name: string; value: any }, { name: string; value: any }],
) => {
  const files = await executeCommand(`find ${target} -type f -name "*" ! -path '*/.git/*'`).then((stdout: string) =>
    stdout.trim().split('\n'),
  );

  // console.log(JSON.stringify(files, null, 2));

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

const deriveProjectName = async (target: PathLike) => {
  const pathEntries = target.toString().split('/');
  const projectDirectoryName = pathEntries[pathEntries.length - 1];
  assert(projectDirectoryName.length > 0);
  return projectDirectoryName;
};

const deriveGithubUser = async () => {
  try {
    const ghUser = (await executeCommand('gh api user -q .login')).trim();
    console.log(`derived github user: '${ghUser}'`);
    return ghUser;
  } catch {
    return undefined;
  }
};

const initFromDirectory = async (
  source: string | URL,
  dest: PathLike,
  options: { git?: any; github?: any; force?: any },
) => {
  const { force } = options;

  try {
    await access(dest);
    if (!force && !(await directoryIsEmpty(dest)))
      throw new Error(`Non-empty directory at dest: '${dest}', use '--force' to create in a non-empty directory`);
  } catch {
    // directory does not exist, we're okay to proceed.
    console.log('creating directory...');
    mkdir(dest, { recursive: true });
  }

  console.log('copying files to directory...');
  cp(_resolve(source + '/files'), dest.toString(), { recursive: true });

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
 * Get the root directory of the current repository.
 */
const repoRoot = async () => {
  const s = (await executeCommand('git rev-parse --show-toplevel')).trim();
  assert(s && s.length > 0, 'Expected to be in a git repo to search to templates');
  return s;
};

const program = new Command();

program.name('april-quickstart').description('CLI to init some default project directories').version('0.0.1');

program
  .command('init')
  .argument('<type>', 'type of project: generic, node, etc')
  .argument('<dest>', 'location of project')
  .option('--force, -f')
  .option('--git', 'init a git repository?', true)
  //.option('--github', 'create repository on github', false)
  .action(async (type, dest, options) => {
    assert(['generic', 'node', 'cad'].includes(type));

    const source = _resolve(`${await repoRoot()}/templates/${type}`);
    dest = _resolve(dest);
    console.log(dest);
    assert(dest.length > 1);
    console.log(`from\t${source}\nto\t${dest}\n`);
    initFromDirectory(source, dest, options);
  });

program.parse();
