import { z } from "zod";

/**
 * form-engine schema — the contract for schema-driven forms.
 *
 * A form is just an array of FieldDefinition. Clinics supply these (in their
 * ClinicConfig.intakeForm); the engine renders inputs and builds a Zod
 * validation schema from them. No hardcoded JSX per clinic.
 *
 * See docs/02-architecture.md ("Schema-driven forms").
 */

export const fieldTypeSchema = z.enum([
  "text",
  "textarea",
  "email",
  "password",
  "phone",
  "number",
  "date",
  "select",
  "radio",
  "checkbox",
]);
export type FieldType = z.infer<typeof fieldTypeSchema>;

export const fieldOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});
export type FieldOption = z.infer<typeof fieldOptionSchema>;

export const fieldDefinitionSchema = z.object({
  /** key used in form values + DB */
  name: z.string().min(1),
  label: z.string().min(1),
  type: fieldTypeSchema,
  required: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  /** for select / radio */
  options: z.array(fieldOptionSchema).optional(),
  /** for number */
  min: z.number().optional(),
  max: z.number().optional(),
});
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;

export const formSchemaSchema = z.array(fieldDefinitionSchema);
export type FormSchema = z.infer<typeof formSchemaSchema>;

/**
 * Build a Zod object schema from a FormSchema, so the same field definitions
 * drive both rendering and validation. Used with @hookform/resolvers/zod.
 */
export function buildZodSchema(fields: FormSchema) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let validator: z.ZodTypeAny;

    switch (field.type) {
      case "email":
        validator = field.required
          ? z.email({ message: `${field.label} must be a valid email` })
          : z.union([z.email(), z.literal("")]).optional();
        break;
      case "number": {
        let num = z.coerce.number();
        if (field.min !== undefined)
          num = num.min(field.min, `${field.label} must be ≥ ${field.min}`);
        if (field.max !== undefined)
          num = num.max(field.max, `${field.label} must be ≤ ${field.max}`);
        validator = field.required ? num : num.optional();
        break;
      }
      case "password":
        validator = field.required
          ? z.string().min(6, `${field.label} must be at least 6 characters`)
          : z.string().optional();
        break;
      case "checkbox":
        validator = field.required
          ? z.literal(true, { message: `${field.label} is required` })
          : z.boolean().optional();
        break;
      case "select":
      case "radio": {
        const values = (field.options ?? []).map((o) => o.value);
        const base =
          values.length > 0
            ? z.enum(values as [string, ...string[]])
            : z.string();
        validator = field.required
          ? base
          : z.union([base, z.literal("")]).optional();
        break;
      }
      default: {
        // text, textarea, phone, date
        validator = field.required
          ? z.string().min(1, `${field.label} is required`)
          : z.string().optional();
      }
    }

    shape[field.name] = validator;
  }

  return z.object(shape);
}
