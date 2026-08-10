import { describe, it, expect } from "vitest";
import { brandingToStyle } from "@ui/theme/branding";

type Vars = Record<string, string>;

describe("brandingToStyle", () => {
  it("maps the primary color onto the core tokens", () => {
    const s = brandingToStyle({ name: "X", primaryColor: "#123456" }) as Vars;
    expect(s["--primary"]).toBe("#123456");
    expect(s["--ring"]).toBe("#123456");
    expect(s["--sidebar-primary"]).toBe("#123456");
  });

  it("sets primary-foreground only when provided (legible on light primaries)", () => {
    const without = brandingToStyle({ name: "X", primaryColor: "#fff" }) as Vars;
    expect(without["--primary-foreground"]).toBeUndefined();

    const withFg = brandingToStyle({
      name: "X",
      primaryColor: "#fff",
      primaryForeground: "#000",
    }) as Vars;
    expect(withFg["--primary-foreground"]).toBe("#000");
    expect(withFg["--sidebar-primary-foreground"]).toBe("#000");
  });

  it("applies arbitrary token overrides last, normalizing keys", () => {
    const s = brandingToStyle({
      name: "X",
      primaryColor: "#111",
      tokens: { "--primary": "#999", background: "#eee" },
    }) as Vars;
    expect(s["--primary"]).toBe("#999"); // override wins over primaryColor
    expect(s["--background"]).toBe("#eee"); // bare key normalized to --background
  });

  it("passes the font stack through as fontFamily", () => {
    const s = brandingToStyle({
      name: "X",
      primaryColor: "#111",
      font: "Inter, sans-serif",
    }) as Vars;
    expect(s.fontFamily).toBe("Inter, sans-serif");
  });
});
