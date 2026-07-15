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
  /** for number: numeric bounds */
  min: z.number().optional(),
  max: z.number().optional(),
  /** for text / textarea / phone: length bounds */
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  /** for text / textarea / phone: regex source the value must match */
  pattern: z.string().optional(),
  /** for password: minimum length (default 6) */
  passwordMin: z.number().int().positive().optional(),
  /** input autocomplete hint, e.g. "new-password", "email", "tel", "off" */
  autoComplete: z.string().optional(),
});
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;

export const formSchemaSchema = z.array(fieldDefinitionSchema);
export type FormSchema = z.infer<typeof formSchemaSchema>;

/**
 * Resolver for validation error messages. Lets the caller (FormRenderer) inject
 * translated strings; defaults to English so buildZodSchema works standalone.
 */
export type ValidationMessageKey =
  | "required"
  | "email"
  | "min"
  | "max"
  | "passwordMin"
  | "minLength"
  | "maxLength"
  | "pattern"
  | "date";

export type ValidationMessages = (
  key: ValidationMessageKey,
  values: { label: string; min?: number; max?: number; len?: number }
) => string;

const defaultMessages: ValidationMessages = (key, v) => {
  switch (key) {
    case "required":
      return `${v.label} is required`;
    case "email":
      return `${v.label} must be a valid email`;
    case "min":
      return `${v.label} must be ≥ ${v.min}`;
    case "max":
      return `${v.label} must be ≤ ${v.max}`;
    case "passwordMin":
      return `${v.label} must be at least ${v.min} characters`;
    case "minLength":
      return `${v.label} must be at least ${v.len} characters`;
    case "maxLength":
      return `${v.label} must be at most ${v.len} characters`;
    case "pattern":
      return `${v.label} is not in the expected format`;
    case "date":
      return `${v.label} must be a valid date`;
  }
};

/**
 * Build a Zod object schema from a FormSchema, so the same field definitions
 * drive both rendering and validation. Used with @hookform/resolvers/zod.
 * Pass `msg` to localize validation errors (see FormRenderer).
 */
export function buildZodSchema(
  fields: FormSchema,
  msg: ValidationMessages = defaultMessages
) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    const label = field.label;
    let validator: z.ZodTypeAny;

    switch (field.type) {
      case "email":
        validator = field.required
          ? z.email({ message: msg("email", { label }) })
          : z.union([z.email(), z.literal("")]).optional();
        break;
      case "number": {
        let num = z.coerce.number();
        if (field.min !== undefined)
          num = num.min(field.min, msg("min", { label, min: field.min }));
        if (field.max !== undefined)
          num = num.max(field.max, msg("max", { label, max: field.max }));
        // Treat an empty input as "unset", NOT 0. Inputs seed number fields with
        // "" (see FormRenderer.defaultValueFor); without this, z.coerce.number("")
        // becomes 0 and an untouched optional number silently submits 0.
        const emptyToUndefined = (v: unknown) =>
          v === "" || v === null ? undefined : v;
        validator = field.required
          ? z.preprocess(emptyToUndefined, num)
          : z.preprocess(emptyToUndefined, num.optional());
        break;
      }
      case "password": {
        const min = field.passwordMin ?? 6;
        validator = field.required
          ? z.string().min(min, msg("passwordMin", { label, min }))
          : z.string().optional();
        break;
      }
      case "date": {
        const valid = z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, msg("date", { label }))
          .refine((v) => !Number.isNaN(Date.parse(v)), msg("date", { label }));
        validator = field.required
          ? z.string().min(1, msg("required", { label })).pipe(valid)
          : z.union([z.literal(""), valid]).optional();
        break;
      }
      case "checkbox":
        validator = field.required
          ? z.literal(true, { message: msg("required", { label }) })
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
        // text, textarea, phone
        let s = z.string();
        if (field.required) s = s.min(1, msg("required", { label }));
        if (field.minLength !== undefined)
          s = s.min(
            field.minLength,
            msg("minLength", { label, len: field.minLength })
          );
        if (field.maxLength !== undefined)
          s = s.max(
            field.maxLength,
            msg("maxLength", { label, len: field.maxLength })
          );
        if (field.pattern) {
          try {
            s = s.regex(new RegExp(field.pattern), msg("pattern", { label }));
          } catch {
            // Invalid pattern in config — skip rather than crash the form.
          }
        }
        // Optional: allow "" (unset) or a value meeting the constraints.
        validator = field.required
          ? s
          : z.union([z.literal(""), s]).optional();
      }
    }

    shape[field.name] = validator;
  }

  return z.object(shape);
}
