/**
 * form-engine — schema-driven form renderer (a core differentiator).
 *
 * Intake forms, patient fields, and service types differ wildly between clinic
 * types. Instead of hardcoding JSX per clinic, forms are RENDERED from config +
 * Zod schemas. Build the engine once; every clinic supplies field definitions.
 *
 * See docs/02-architecture.md ("Schema-driven forms").
 * NOTE: Phase 0 stub — implemented in Phase 1.
 */

export type FieldType =
  | "text"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "checkbox"
  | "textarea";

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { label: string; value: string }[];
  // validation, conditional visibility, etc. — Phase 1
}

export type FormSchema = FieldDefinition[];
