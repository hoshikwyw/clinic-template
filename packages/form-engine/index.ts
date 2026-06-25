/**
 * form-engine — schema-driven form renderer (a core differentiator).
 *
 * Intake forms, patient fields, and service types differ wildly between clinic
 * types. Instead of hardcoding JSX per clinic, forms are RENDERED from config +
 * Zod schemas. Build the engine once; every clinic supplies field definitions.
 *
 * See docs/02-architecture.md ("Schema-driven forms").
 */

export {
  fieldTypeSchema,
  fieldOptionSchema,
  fieldDefinitionSchema,
  formSchemaSchema,
  buildZodSchema,
  type FieldType,
  type FieldOption,
  type FieldDefinition,
  type FormSchema,
} from "./schema";

export { FormRenderer, type FormRendererProps } from "./form-renderer";
