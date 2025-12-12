import z from 'zod';

export const JumpstartDefinition = z.object({
  'post-copy': z.array(z.string()),
});
export type JumpstartDefinition = z.infer<typeof JumpstartDefinition>;

export const TemplateFileSchema = z.object({ jumpstart: JumpstartDefinition });
export type TemplateFileSchema = z.infer<typeof TemplateFileSchema>;
