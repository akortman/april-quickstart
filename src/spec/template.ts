import z from 'zod/v4';

export const JumpstartStep = z.union([
  z.object({ copy: z.object({ from: z.string(), to: z.string().optional() }) }),
  z.object({ run: z.array(z.string()) }),
]);
export type JumpstartStep = z.infer<typeof JumpstartStep>;

export const JumpstartDefinition = z.object({
  extends: z.union([z.array(z.string()), z.string()]).optional(),
  steps: z.array(JumpstartStep),
});
export type JumpstartDefinition = z.infer<typeof JumpstartDefinition>;

export const TemplateFileSchema = z.object({ jumpstart: JumpstartDefinition });
export type TemplateFileSchema = z.infer<typeof TemplateFileSchema>;
