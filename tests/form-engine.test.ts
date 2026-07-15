import { describe, it, expect } from "vitest";
import { buildZodSchema, type FormSchema } from "@form-engine/schema";

function check(schema: FormSchema, value: Record<string, unknown>) {
  return buildZodSchema(schema).safeParse(value).success;
}

describe("buildZodSchema", () => {
  it("requires non-empty values for required text fields", () => {
    const schema: FormSchema = [
      { name: "a", label: "A", type: "text", required: true },
    ];
    expect(check(schema, { a: "hello" })).toBe(true);
    expect(check(schema, { a: "" })).toBe(false);
  });

  it("allows empty optional fields", () => {
    const schema: FormSchema = [
      { name: "a", label: "A", type: "text", required: false },
    ];
    expect(check(schema, { a: "" })).toBe(true);
    expect(check(schema, {})).toBe(true);
  });

  it("validates email format when required", () => {
    const schema: FormSchema = [
      { name: "e", label: "Email", type: "email", required: true },
    ];
    expect(check(schema, { e: "x@y.com" })).toBe(true);
    expect(check(schema, { e: "not-an-email" })).toBe(false);
  });

  it("enforces number min/max", () => {
    const schema: FormSchema = [
      { name: "n", label: "N", type: "number", required: true, min: 0, max: 10 },
    ];
    expect(check(schema, { n: 5 })).toBe(true);
    expect(check(schema, { n: -1 })).toBe(false);
    expect(check(schema, { n: 11 })).toBe(false);
  });

  it("treats an empty optional number as unset, not 0", () => {
    const schema: FormSchema = [
      { name: "n", label: "N", type: "number", required: false, min: 1 },
    ];
    // Inputs seed number fields with "" — that must stay unset (undefined),
    // not coerce to 0 (which would also violate min: 1).
    const parsed = buildZodSchema(schema).safeParse({ n: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.n).toBeUndefined();
  });

  it("restricts select to its option values", () => {
    const schema: FormSchema = [
      {
        name: "s",
        label: "S",
        type: "select",
        required: true,
        options: [
          { label: "X", value: "x" },
          { label: "Y", value: "y" },
        ],
      },
    ];
    expect(check(schema, { s: "x" })).toBe(true);
    expect(check(schema, { s: "z" })).toBe(false);
  });

  it("requires required checkboxes to be true", () => {
    const schema: FormSchema = [
      { name: "c", label: "Agree", type: "checkbox", required: true },
    ];
    expect(check(schema, { c: true })).toBe(true);
    expect(check(schema, { c: false })).toBe(false);
  });

  it("enforces text minLength/maxLength/pattern", () => {
    const schema: FormSchema = [
      {
        name: "t",
        label: "T",
        type: "text",
        required: true,
        minLength: 2,
        maxLength: 4,
        pattern: "^[a-z]+$",
      },
    ];
    expect(check(schema, { t: "abc" })).toBe(true);
    expect(check(schema, { t: "a" })).toBe(false); // too short
    expect(check(schema, { t: "abcde" })).toBe(false); // too long
    expect(check(schema, { t: "AB1" })).toBe(false); // pattern
  });

  it("allows empty optional text but validates constraints when filled", () => {
    const schema: FormSchema = [
      { name: "t", label: "T", type: "text", required: false, minLength: 3 },
    ];
    expect(check(schema, { t: "" })).toBe(true);
    expect(check(schema, { t: "ab" })).toBe(false);
    expect(check(schema, { t: "abc" })).toBe(true);
  });

  it("validates date fields", () => {
    const schema: FormSchema = [
      { name: "d", label: "D", type: "date", required: true },
    ];
    expect(check(schema, { d: "2026-07-15" })).toBe(true);
    expect(check(schema, { d: "15/07/2026" })).toBe(false);
    expect(check(schema, { d: "2026-13-40" })).toBe(false);
    expect(check(schema, { d: "" })).toBe(false);
  });

  it("honors a configurable password minimum", () => {
    const schema: FormSchema = [
      { name: "p", label: "P", type: "password", required: true, passwordMin: 10 },
    ];
    expect(check(schema, { p: "shortpass" })).toBe(false); // 9 chars
    expect(check(schema, { p: "longenough1" })).toBe(true); // 11 chars
  });
});
