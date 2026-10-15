import type { Plugin } from "vite";
import postcss, { type AtRule, type ChildNode, type Declaration, type Rule } from "postcss";

/**
 * Colour fallbacks for older browsers (Chrome/Edge < 111, Safari < 16.4,
 * e.g. Chrome 109 on Windows 7/8.1 and older iPhones).
 *
 * Tailwind v4 writes colours as oklch(), mixes opacity with color-mix() and
 * interpolates gradients "in oklab". Older browsers understand none of these,
 * so buttons lose their colours and tinted backgrounds turn solid. This build
 * step adds, next to the modern CSS:
 *   1. an sRGB copy of every oklch() colour (custom properties get theirs in
 *      an @supports-not block, plain properties get a fallback declaration);
 *   2. "r g b" channels for every colour variable, and rgb(... / N%) versions
 *      of the color-mix() opacity rules for browsers without color-mix();
 *   3. gradient directions without "in oklab".
 * Modern browsers keep using the original rules; nothing changes for them.
 */

const NO_OKLCH = "not (color: oklch(0 0 0))";
const NO_COLOR_MIX = "not (color: color-mix(in lab, red, red))";
const NO_GRADIENT_SPACE = "not (background-image: linear-gradient(in oklab, red, red))";

type RGBA = { r: number; g: number; b: number; a: number };

function parseNumber(token: string, percentScale: number): number {
  const t = token.trim();
  if (t === "none") return 0;
  if (t.endsWith("%")) return (parseFloat(t) / 100) * percentScale;
  if (t.endsWith("deg")) return parseFloat(t);
  return parseFloat(t);
}

function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (c: [number, number, number]) => c.every((v) => v >= -0.0001 && v <= 1.0001);
const gammaEncode = (v: number) => {
  const x = Math.min(1, Math.max(0, v));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
};

/** oklch -> sRGB, reducing chroma (keeping lightness and hue) when out of gamut. */
function oklchToRgb(L: number, C: number, H: number, alpha: number): RGBA {
  const h = (H * Math.PI) / 180;
  const lab = (c: number) => oklabToLinearSrgb(L, c * Math.cos(h), c * Math.sin(h));
  let lin = lab(C);
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(lab(mid))) lo = mid;
      else hi = mid;
    }
    lin = lab(lo);
  }
  const [r, g, b] = lin.map((v) => Math.round(gammaEncode(v) * 255));
  return { r: r!, g: g!, b: b!, a: alpha };
}

const OKLCH_RE = /oklch\(\s*([^)]*?)\s*\)/gi;

function parseOklch(inner: string): RGBA | null {
  const [main, alphaPart] = inner.split("/");
  const parts = (main ?? "").trim().split(/[\s,]+/);
  if (parts.length < 3) return null;
  const L = parseNumber(parts[0]!, 1);
  const C = parseNumber(parts[1]!, 0.4);
  const H = parseNumber(parts[2]!, 360);
  const alpha = alphaPart ? parseNumber(alphaPart, 1) : 1;
  if ([L, C, H, alpha].some((n) => Number.isNaN(n))) return null;
  return oklchToRgb(L, C, H, alpha);
}

const hex2 = (n: number) => n.toString(16).padStart(2, "0");
function rgbToCss({ r, g, b, a }: RGBA): string {
  if (a >= 1) return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return `rgb(${r} ${g} ${b} / ${Math.round(a * 1000) / 1000})`;
}

/** Replaces every oklch() in a value; returns null if one cannot be parsed. */
function convertOklch(value: string): string | null {
  let failed = false;
  const out = value.replace(OKLCH_RE, (_, inner: string) => {
    const rgb = parseOklch(inner);
    if (!rgb) {
      failed = true;
      return "";
    }
    return rgbToCss(rgb);
  });
  return failed ? null : out;
}

/** Plain colour value (after conversion) -> "r g b" channels, or null. */
function channels(value: string): string | null {
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) {
    const [r, g, b] = m[1]!.split("").map((c) => parseInt(c + c, 16));
    return `${r} ${g} ${b}`;
  }
  m = /^#([0-9a-f]{6})$/.exec(v);
  if (m) {
    const n = m[1]!;
    return `${parseInt(n.slice(0, 2), 16)} ${parseInt(n.slice(2, 4), 16)} ${parseInt(n.slice(4, 6), 16)}`;
  }
  return null;
}

/** Inserts `decls` in `@supports <cond> { selector { ... } }` right after `after`. */
function addSupportsSibling(after: ChildNode, cond: string, selector: string, decls: Declaration[]) {
  if (decls.length === 0) return;
  const rule = postcss.rule({ selector });
  for (const d of decls) rule.append(d);
  const at = postcss.atRule({ name: "supports", params: cond });
  at.append(rule);
  after.after(at);
}

const COLOR_MIX_RE = /color-mix\(in oklab,\s*var\((--[\w-]+)\)\s+([\d.]+)%,\s*transparent\)/g;

export function addLegacyColorFallbacks(css: string): string {
  const root = postcss.parse(css);
  const channelVars = new Set<string>();

  // Pass 1: oklch() -> sRGB, colour channels, gradient directions.
  root.walkRules((rule: Rule) => {
    const customFallbacks: Declaration[] = [];
    const gradientFallbacks: Declaration[] = [];
    rule.each((node) => {
      if (node.type !== "decl") return;
      const decl = node;
      const isCustom = decl.prop.startsWith("--");
      let plain = decl.value;

      if (/oklch\(/i.test(decl.value)) {
        const converted = convertOklch(decl.value);
        if (converted) {
          plain = converted;
          if (isCustom) customFallbacks.push(postcss.decl({ prop: decl.prop, value: converted }));
          else decl.before(postcss.decl({ prop: decl.prop, value: converted }));
        }
      }

      if (isCustom) {
        const ch = channels(plain);
        if (ch) {
          decl.after(postcss.decl({ prop: `${decl.prop}-rgb`, value: ch }));
          channelVars.add(decl.prop);
        }
      }

      if (decl.prop === "--tw-gradient-position" && /\sin\s+oklab/i.test(decl.value)) {
        gradientFallbacks.push(
          postcss.decl({ prop: decl.prop, value: decl.value.replace(/\s+in\s+oklab/i, "") }),
        );
      }
    });
    addSupportsSibling(rule, NO_OKLCH, rule.selector, customFallbacks);
    addSupportsSibling(rule, NO_GRADIENT_SPACE, rule.selector, gradientFallbacks);
  });

  // Variables that point at another colour variable (e.g. --color-primary: var(--primary)).
  root.walkDecls((decl) => {
    const m = /^var\((--[\w-]+)\)$/.exec(decl.value.trim());
    if (decl.prop.startsWith("--") && m && channelVars.has(m[1]!) && !channelVars.has(decl.prop)) {
      decl.after(postcss.decl({ prop: `${decl.prop}-rgb`, value: `var(${m[1]}-rgb)` }));
      channelVars.add(decl.prop);
    }
  });

  // Pass 2: color-mix() opacity -> rgb(var(--x-rgb) / N%) for browsers without color-mix().
  root.walkAtRules("supports", (at: AtRule) => {
    if (!/color-mix\(in lab/i.test(at.params) || /^not\b/i.test(at.params.trim())) return;
    const rules: Rule[] = [];
    at.walkRules((rule) => {
      const decls: Declaration[] = [];
      rule.walkDecls((decl) => {
        if (!decl.value.includes("color-mix(")) return;
        let ok = true;
        const value = decl.value.replace(COLOR_MIX_RE, (_, v: string, pct: string) => {
          if (!channelVars.has(v)) ok = false;
          return `rgb(var(${v}-rgb) / ${pct}%)`;
        });
        if (ok && !value.includes("color-mix(")) decls.push(postcss.decl({ prop: decl.prop, value }));
      });
      if (decls.length) {
        const r = postcss.rule({ selector: rule.selector });
        for (const d of decls) r.append(d);
        rules.push(r);
      }
    });
    if (rules.length) {
      const fallback = postcss.atRule({ name: "supports", params: NO_COLOR_MIX });
      for (const r of rules) fallback.append(r);
      at.after(fallback);
    }
  });

  return root.toString();
}

const MARKER = "/* legacy-colors */";

function transformOnce(css: string): string | null {
  if (css.includes(MARKER)) return null;
  return `${MARKER}\n${addLegacyColorFallbacks(css)}`;
}

/**
 * Vite plugin: applies the fallbacks to the final CSS files of the build.
 * Works in generateBundle and, as a safety net, on the written files in
 * writeBundle (some setups emit CSS after other plugins' generateBundle).
 */
export function legacyColors(): Plugin {
  let count = 0;
  return {
    name: "tursya-legacy-colors",
    apply: "build",
    enforce: "post",
    buildStart() {
      count = 0;
    },
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".css")) continue;
        const source = typeof file.source === "string" ? file.source : new TextDecoder().decode(file.source);
        const out = transformOnce(source);
        if (out) {
          file.source = out;
          count++;
        }
      }
    },
    async writeBundle(options, bundle) {
      const { readFile, writeFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const dir = options.dir;
      if (!dir) return;
      for (const name of Object.keys(bundle)) {
        if (!name.endsWith(".css")) continue;
        const path = join(dir, name);
        const out = transformOnce(await readFile(path, "utf8").catch(() => MARKER));
        if (out) {
          await writeFile(path, out, "utf8");
          count++;
        }
      }
      console.log(`[legacy-colors] ${count} CSS file(s) with fallbacks (${this.environment?.name ?? "build"})`);
    },
  };
}
