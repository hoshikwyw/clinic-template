"use client";

import * as React from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import { Button } from "@ui/primitives/button";
import { Input } from "@ui/primitives/input";
import { Textarea } from "@ui/primitives/textarea";
import { Checkbox } from "@ui/primitives/checkbox";
import { RadioGroup, RadioGroupItem } from "@ui/primitives/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/primitives/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ui/primitives/form";

import { buildZodSchema, type FieldDefinition, type FormSchema } from "./schema";

function defaultValueFor(field: FieldDefinition) {
  if (field.type === "checkbox") return false;
  return "";
}

function computeDefaults(schema: FormSchema): Record<string, unknown> {
  return Object.fromEntries(schema.map((f) => [f.name, defaultValueFor(f)]));
}

export interface FormRendererProps {
  schema: FormSchema;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  submitLabel?: string;
  defaultValues?: Record<string, unknown>;
}

/**
 * Renders a validated, accessible form straight from a FormSchema.
 * Same definitions drive rendering AND validation (via buildZodSchema).
 * See docs/02-architecture.md ("Schema-driven forms").
 */
export function FormRenderer({
  schema,
  onSubmit,
  submitLabel = "Submit",
  defaultValues,
}: FormRendererProps) {
  const tv = useTranslations("validation");
  const zodSchema = React.useMemo(
    () => buildZodSchema(schema, (key, values) => tv(key, values)),
    [schema, tv]
  );

  // Cast bridges a known @hookform/resolvers <-> Zod 4 internal type skew
  // (duplicate zod type versions in the tree); correct at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolver = zodResolver(zodSchema as any) as Resolver<FieldValues>;

  const form = useForm<FieldValues>({
    resolver,
    defaultValues: {
      ...computeDefaults(schema),
      ...defaultValues,
    } as DefaultValues<FieldValues>,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {schema.map((field) => (
          <FormField
            key={field.name}
            control={form.control}
            name={field.name}
            render={({ field: rhf }) => (
              <FormItem>
                {field.type !== "checkbox" && (
                  <FormLabel>
                    {field.label}
                    {field.required && (
                      <span className="text-destructive"> *</span>
                    )}
                  </FormLabel>
                )}

                {renderControl(field, rhf)}

                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        <Button type="submit" size="lg" className="w-full sm:w-auto">
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function renderControl(field: FieldDefinition, rhf: any) {
  switch (field.type) {
    case "textarea":
      return (
        <FormControl>
          <Textarea placeholder={field.placeholder} {...rhf} />
        </FormControl>
      );

    case "select":
      return (
        <Select value={rhf.value ?? ""} onValueChange={rhf.onChange}>
          <FormControl>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={field.placeholder ?? "Select…"} />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "radio":
      return (
        <FormControl>
          <RadioGroup value={rhf.value ?? ""} onValueChange={rhf.onChange}>
            {(field.options ?? []).map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-3 text-sm"
              >
                <RadioGroupItem value={o.value} />
                {o.label}
              </label>
            ))}
          </RadioGroup>
        </FormControl>
      );

    case "checkbox":
      return (
        <label className="flex items-center gap-3 text-sm font-medium">
          <Checkbox
            checked={!!rhf.value}
            onCheckedChange={rhf.onChange}
          />
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </label>
      );

    case "number":
      return (
        <FormControl>
          <Input
            type="number"
            inputMode="numeric"
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            {...rhf}
          />
        </FormControl>
      );

    case "date":
      return (
        <FormControl>
          <Input type="date" {...rhf} />
        </FormControl>
      );

    case "email":
      return (
        <FormControl>
          <Input type="email" placeholder={field.placeholder} {...rhf} />
        </FormControl>
      );

    case "password":
      return (
        <FormControl>
          <Input
            type="password"
            autoComplete="current-password"
            placeholder={field.placeholder}
            {...rhf}
          />
        </FormControl>
      );

    case "phone":
      return (
        <FormControl>
          <Input type="tel" placeholder={field.placeholder} {...rhf} />
        </FormControl>
      );

    default:
      return (
        <FormControl>
          <Input type="text" placeholder={field.placeholder} {...rhf} />
        </FormControl>
      );
  }
}
