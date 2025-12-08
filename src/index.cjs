const { Command } = require('commander');
const fs = require('fs/promises');
const childProcess = require('node:child_process');
const path = require('path');
const assert = require('node:assert').strict;
const dotenv = require('dotenv');

dotenv.config();

const variablePrefix = '__TODO';
const variableEnvVarPrefix = 'APRIL_QUICKSTART';

const executeCommand = async (command, cwd = undefined) =>
  new Promise((resolve, reject) =>
    childProcess.exec(command, { cwd, shell: true }, function (err, stdout, stderr) {
      if (err) {
        console.error(err);
        reject(stderr);
      }
      resolve(stdout);
    }),
  );

/**
 * Sourced from https://stackoverflow.com/questions/39217271/how-to-determine-whether-the-directory-is-empty-directory-with-nodejs
 */
const directoryIsEmpty = async (dir) => {
  return fs.readdir(dir).then((files) => {
    return files.length === 0;
  });
};

// substitute variables in the target dir.
const substituteVariables = async (target, variables) => {
  const files = await executeCommand(`find ${target} -type f -name "*" ! -path '*/.git/*'`).then((stdout) =>
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
    let fileText = await fs.readFile(f).then((b) => b.toString());
    for (const v of variables) {
      if (v.value === undefined || v.value === null) {
        continue;
      }
      fileText = fileText.replaceAll(v.name, v.value);
    }
    await fs.writeFile(f, fileText);
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

const initRepo = async (target, _repositoryName, _options) => {
  console.log('init repository at target...');
  //if (options.github) {
  //  await executeCommand(
  //    `gh repo create ${repositoryName} --private  --source=${target} --remote=upstream`,
  //    target,
  //  ).then(console.log);
  //}

  await executeCommand('git init', target).then(console.log);
  await executeCommand('git add .', target).then(console.log);
  // TODO: we should check if there are any commits yet in case this is in-place.
  //await executeCommand('git commit -m "feat: initial commit"', target).then(console.log);
};

const deriveProjectName = async (target) => {
  const pathEntries = target.split('/');
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

const initFromDirectory = async (source, dest, options) => {
  const { force } = options;

  try {
    await fs.access(dest);
    if (!force && !(await directoryIsEmpty(dest)))
      throw new Error(`Non-empty directory at dest: '${dest}', use '--force' to create in a non-empty directory`);
  } catch {
    // directory does not exist, we're okay to proceed.
    console.log('creating directory...');
    fs.mkdir(dest, { recursive: true });
  }

  console.log('copying files to directory...');
  fs.cp(source, dest, { recursive: true });

  console.log('substituting variables...');
  const makeVariableEntry = async (name, getValue) => ({
    name: `${variablePrefix}_${name}`,
    value: process.env[`${variableEnvVarPrefix}_${name}`] || (await getValue()),
  });

  const repositoryNameVariable = await makeVariableEntry('PROJECT_NAME', () => deriveProjectName(dest));
  await substituteVariables(
    dest,
    await Promise.all([
      await repositoryNameVariable,
      await makeVariableEntry('GITHUB_USER', deriveGithubUser),
      await makeVariableEntry('PROJECT_DESCRIPTION', () => ''),
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
  const s = await executeCommand('git rev-parse --show-toplevel');
  return s.trim();
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
    const source = path.resolve(`${await repoRoot()}/templates/${type}`);
    dest = path.resolve(dest);
    console.log(dest);
    assert(dest.length > 1);
    console.log(`from\t${source}\nto\t${dest}\n`);
    initFromDirectory(source, dest, options);
  });

program.parse();
