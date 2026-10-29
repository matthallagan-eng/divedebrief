// Every drawing is its own .svg file under src/assets/sea, so it can be opened
// and changed in a vector editor (Inkscape, Figma, Illustrator). Colours come
// from the file as drawn. Each drawing's shape (width / height) is read from
// its viewBox, so resizing the canvas in the editor is fine.

export interface Drawing {
  svg: string; // the file's markup, drawn inline so parts may poke past the canvas as before
  aspect: number;
}

function load(files: Record<string, string>): Record<string, Drawing> {
  return Object.fromEntries(
    Object.entries(files).map(([path, svg]) => {
      const name = path.slice(path.lastIndexOf("/") + 1, -".svg".length);
      const box = svg.match(/viewBox="([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
      const aspect = box && box[2] > 0 && box[3] > 0 ? box[2] / box[3] : 1;
      return [name, { svg: svg.slice(svg.indexOf("<svg")), aspect }];
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
