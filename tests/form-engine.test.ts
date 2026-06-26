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
});
