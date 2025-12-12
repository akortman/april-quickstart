import fs from 'fs';
import yaml from 'js-yaml';
import { z } from 'zod/v4';
import { resolve as resolvePath } from 'path';
import { executeCommand } from './execute-command';

const QuickstartDefinition = z.object({
  'post-copy': z.array(z.string()),
});
type QuickstartDefinition = z.infer<typeof QuickstartDefinition>;

const TemplateFileSchema = z.object({ quickstart: QuickstartDefinition });

const validateAndLoadFromDirectory = async (path: fs.PathLike): Promise<QuickstartDefinition> => {
  try {
    return TemplateFileSchema.parse(yaml.load(fs.readFileSync(path, 'utf8'))).quickstart;
  } catch (e) {
    console.warn(`No config file found at ${path}: '${String(e)}'`);
    if (!fs.existsSync(path + '/files')) {
      console.log(`(legacy) will copy from ${resolvePath(path + '/files')}`);
    } else {
      throw new Error(`No quickstart.yaml or files directory: is ${path} a valid quickstart directory?`);
    }
    return {
      'post-copy': [],
    };
  }
};

export const loadTemplateDefinition = async (path: fs.PathLike) => {
  const template = await validateAndLoadFromDirectory(resolvePath(path + '/quickstart.yaml'));

  return {
    template: template,
    sourceDirectory: path,
    postCopy: async (dest: fs.PathLike) => {
      if (!template['post-copy']) return;
      const script = template['post-copy'].join(' && ');
      console.log(`exec post-copy... '${script}'`);
      const stdout = await executeCommand(script, dest);
      console.log(
        stdout
          .split('\n')
          .map((l) => `post-copy > ${l}`)
          .join('\n'),
      );
      return stdout;
    },
  };
};
