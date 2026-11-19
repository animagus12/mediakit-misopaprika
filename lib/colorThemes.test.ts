import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COLOR_THEME_ATTRIBUTE,
  COLOR_THEME_INIT_SCRIPT,
  COLOR_THEME_STORAGE_KEY,
  COLOR_THEMES,
  DEFAULT_COLOR_THEME,
  colorThemeLabel,
  isColorTheme,
} from "./colorThemes";

const readCss = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8").replace(/\r\n/g, "\n");

// Runs the inline script against a stand-in storage and <html>, returning
// the attribute it set (or null).
function runInitScript(getItem: (key: string) => string | null) {
  const attributes = new Map<string, string>();
  const documentStub = { documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) } };
  new Function("localStorage", "document", COLOR_THEME_INIT_SCRIPT)({ getItem }, documentStub);
  return attributes.get(COLOR_THEME_ATTRIBUTE) ?? null;
}

// The custom properties a CSS rule sets, by its exact selector list.
function tokensOf(css: string, selector: string): string[] {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return [];
  const body = css.slice(start, css.indexOf("}", start));
  return [...body.matchAll(/--([\w-]+):/g)].map((match) => match[1]).sort();
}

describe("isColorTheme", () => {
  it("accepts every theme in the list and nothing else", () => {
    for (const { id } of COLOR_THEMES) expect(isColorTheme(id)).toBe(true);
    expect(isColorTheme("solarized")).toBe(false);
    expect(isColorTheme("")).toBe(false);
    expect(isColorTheme(null)).toBe(false);
  });

  it("has the default in the list", () => {
    expect(isColorTheme(DEFAULT_COLOR_THEME)).toBe(true);
    expect(colorThemeLabel("rose-pine")).toBe("Rosé Pine");
  });
});

describe("COLOR_THEME_INIT_SCRIPT", () => {
  it("applies a saved theme", () => {
    expect(runInitScript((key) => (key === COLOR_THEME_STORAGE_KEY ? "dracula" : null))).toBe("dracula");
  });

  it("leaves the default for nothing saved or an unknown value", () => {
    expect(runInitScript(() => null)).toBeNull();
    expect(runInitScript(() => "not-a-theme")).toBeNull();
  });

  it("never throws when storage does", () => {
    expect(
      runInitScript(() => {
        throw new Error("SecurityError");
      }),
    ).toBeNull();
  });
});

describe("theme stylesheets", () => {
  const themesCss = readCss("../app/themes.css");
  const globalsCss = readCss("../app/globals.css");

  it("give every listed theme a light and a dark block setting the same tokens", () => {
    for (const { id } of COLOR_THEMES) {
      if (id === DEFAULT_COLOR_THEME) continue;
      const light = tokensOf(themesCss, `:root[data-color-theme="${id}"],\n[data-color-theme="${id}"]`);
      const dark = tokensOf(themesCss, `:root.dark[data-color-theme="${id}"],\n.dark [data-color-theme="${id}"]`);
      expect(light.length, `${id} light block`).toBeGreaterThan(0);
      expect(dark, `${id} dark block`).toEqual(light);
    }
  });

  it("keep the default reachable by attribute, for the menu's preview", () => {
    expect(globalsCss).toContain(`:root,\n[data-color-theme="${DEFAULT_COLOR_THEME}"] {`);
    expect(globalsCss).toContain(`.dark,\n.dark [data-color-theme="${DEFAULT_COLOR_THEME}"] {`);
  });
});
