import { Command } from 'commander';
import dotenv from 'dotenv';
import { initProject } from './commands/init';

dotenv.config();

const program = new Command();

program.name('april-quickstart').description('CLI to init some default project directories').version('0.0.1');

program
  .command('init')
  .argument('<template>', 'name of template')
  .argument('<dest>', 'location of project')
  .option('--force, -f')
  .option('--git', 'init a git repository?', true)
  //.option('--github', 'create repository on github', false)
  .action(async (template, dest, options) => initProject(template, dest, options));

program.parse();
