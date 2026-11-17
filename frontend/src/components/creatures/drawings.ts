// Every drawing is its own .svg file under src/assets/sea, so it can be opened
// and changed in a vector editor (Inkscape, Figma, Illustrator). Colours come
// from the file as drawn. Each drawing's shape (width / height) is read from
// its viewBox, so resizing the canvas in the editor is fine.

export interface Drawing {
  svg: string; // the file's markup, drawn inline so parts may poke past the canvas as before
  aspect: number;
}

// Drawings are inlined into one page, so a <style> block in one file applies to
// all of them. Editors export generic class names (.s0, .s1, ...), so prefix every
// class a file's stylesheet defines with the file's name to keep files apart.
function scopeClasses(svg: string, name: string): string {
  const css = [...svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
  const classes = new Set([...css.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map((m) => m[1]));
  if (classes.size === 0) return svg;
  const scoped = (cls: string) => (classes.has(cls) ? `${name}__${cls}` : cls);
  return svg
    .replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (_, attrs: string, body: string) =>
      `<style${attrs}>${body.replace(/\.(-?[A-Za-z_][\w-]*)/g, (_m, cls: string) => `.${scoped(cls)}`)}</style>`,
    )
    .replace(/\bclass="([^"]*)"/g, (_, list: string) => `class="${list.split(/\s+/).map(scoped).join(" ")}"`);
}

function load(files: Record<string, string>): Record<string, Drawing> {
  return Object.fromEntries(
    Object.entries(files).map(([path, svg]) => {
      const name = path.slice(path.lastIndexOf("/") + 1, -".svg".length);
      const box = svg.match(/viewBox="([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
      const aspect = box && box[2] > 0 && box[3] > 0 ? box[2] / box[3] : 1;
      return [name, { svg: scopeClasses(svg.slice(svg.indexOf("<svg")), name), aspect }];
    }),
  );
}

// The unlockable creatures, named like app/achievements.py (clownfish.svg). They face right.
// Vite reads these options only when they're written out in the call itself
export const CREATURE_DRAWINGS = load(
  import.meta.glob<string>("../../assets/sea/creatures/*.svg", { query: "?raw", import: "default", eager: true }),
);

// The background scene: fish, shark, whale, lobster, shipwreck, reef
export const SCENE_DRAWINGS = load(
  import.meta.glob<string>("../../assets/sea/scene/*.svg", { query: "?raw", import: "default", eager: true }),
);
