import fs, { PathLike, PathOrFileDescriptor } from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { JumpstartDefinition, JumpstartStep, TemplateFileSchema } from '../spec/template';
import { repoRoot } from '.';

export type LoadedTemplateDefinition = {
  canonicalName: string;
  template: JumpstartDefinition;
  sourceDirectory: PathOrFileDescriptor;
  extends: LoadedTemplateDefinition[];
  steps: JumpstartStep[];
};

const validateAndLoadFromDirectory = async (path: fs.PathLike): Promise<JumpstartDefinition> => {
  try {
    return TemplateFileSchema.parse(yaml.load(fs.readFileSync(path, 'utf8'))).jumpstart;
  } catch (e) {
    // TODO: better error logging
    throw new Error(`Error loading config file at ${path}: '${String(e)}''`);
  }
};

/**
 * Given a template string description, try and locate the template file(s).
 * @param templateArg
 */
const resolveTemplateDescriptorToDirectory = async (templateDescriptor: string): Promise<PathLike> => {
  const getDirectoryPath = async () => {
    if (templateDescriptor.startsWith('repo:')) {
      return `${await repoRoot()}/${templateDescriptor.substring('repo:'.length)}`;
    } else if (templateDescriptor.includes('/')) {
      // assume the descriptor is a directory
      return templateDescriptor;
    } else {
      // assume we have the name of one of the existing templates
      return `${await repoRoot()}/templates/${templateDescriptor}`;
    }
  };
  return path.resolve(await getDirectoryPath());
};

const getCanonicalName = (_template: JumpstartDefinition, sourceDirectory: PathLike) => {
  // For now we use the directory name.
  const parts = String(sourceDirectory)
    .split('/')
    .filter((s) => !!s);
  return parts[parts.length - 1];
};

const MAX_RECURSIVE_LOAD_DEPTH = 4;

export const loadTemplateDefinition = async (
  templateDescriptor: string,
  _depth = 0,
): Promise<LoadedTemplateDefinition> => {
  if (_depth >= MAX_RECURSIVE_LOAD_DEPTH) {
    throw new Error(
      `Aborting load of template definition '${templateDescriptor}: maximum recursive depth of ` +
        `${MAX_RECURSIVE_LOAD_DEPTH} reached`,
    );
  }
  const sourceDirectory = await resolveTemplateDescriptorToDirectory(templateDescriptor);
  const template = await validateAndLoadFromDirectory(path.resolve(sourceDirectory + '/jumpstart.yaml'));
  const extendsList = (typeof template.extends === 'string' ? [template.extends] : template.extends) || [];
  const extendsTemplates = await Promise.all(extendsList.map((item) => loadTemplateDefinition(item, _depth + 1)));

  return {
    canonicalName: getCanonicalName(template, sourceDirectory),
    template: template,
    sourceDirectory,
    extends: extendsTemplates,
    steps: template.steps,
  };
};
