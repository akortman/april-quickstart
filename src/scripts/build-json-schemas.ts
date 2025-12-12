import z from 'zod';
import { TemplateFileSchema } from '../spec/template';
import fs from 'node:fs/promises';
import { repoRoot } from '../util';

const SCHEMA_FILE_NAME = 'jumpstart.schema.json';
const SCHEMA_FILE_LOCATION = `spec/${SCHEMA_FILE_NAME}`;

const buildJsonSchemas = async () => {
  const schema = JSON.stringify(
    {
      $id: `http://rodent.zone/jumpstart/schemas/${SCHEMA_FILE_NAME}`,
      ...z.toJSONSchema(TemplateFileSchema),
    },
    null,
    2,
  );
  fs.writeFile(`${await repoRoot()}/${SCHEMA_FILE_LOCATION}`, schema);
};

await buildJsonSchemas();
