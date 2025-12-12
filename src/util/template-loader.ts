import fs, { PathLike, PathOrFileDescriptor } from 'fs';
import yaml from 'js-yaml';
import { z } from 'zod/v4';
import { resolve as resolvePath } from 'path';

const JumpstartDefinition = z.object({
  'post-copy': z.array(z.string()),
});
type JumpstartDefinition = z.infer<typeof JumpstartDefinition>;

const TemplateFileSchema = z.object({ jumpstart: JumpstartDefinition });

const validateAndLoadFromDirectory = async (path: fs.PathLike): Promise<JumpstartDefinition> => {
  try {
    return TemplateFileSchema.parse(yaml.load(fs.readFileSync(path, 'utf8'))).jumpstart;
  } catch (e) {
    console.warn(`No config file found at ${path}: '${String(e)}'`);
    if (!fs.existsSync(path + '/files')) {
      console.log(`(legacy) will copy from ${resolvePath(path + '/files')}`);
    } else {
      throw new Error(`No jumpstart.yaml or files directory: is ${path} a valid jumpstart directory?`);
    }
    return {
      'post-copy': [],
    };
  }
};

type TemplateDeployStep = { copy: { from: PathLike } } | { run: string[] };

export type TemplateDefinition = {
  template: JumpstartDefinition;
  sourceDirectory: PathOrFileDescriptor;
  extends?: TemplateDefinition[];
  steps: TemplateDeployStep[];
};

export const loadTemplateDefinition = async (sourceDirectory: fs.PathLike): Promise<TemplateDefinition> => {
  const template = await validateAndLoadFromDirectory(resolvePath(sourceDirectory + '/jumpstart.yaml'));
  const steps = [
    { copy: { from: sourceDirectory } },
    ...(template['post-copy'] ? [{ run: template['post-copy'] }] : []),
  ];

  return {
    template: template,
    sourceDirectory,
    extends: [],
    steps,
  };
};
