import type { Drawing } from "./drawings";

/** One of the .svg files under assets/sea, filling its box. */
export function DrawingView({ drawing }: { drawing: Drawing | undefined }) {
  if (!drawing) return null;
  // Our own bundled files, not user content
  return <div className="drawing" dangerouslySetInnerHTML={{ __html: drawing.svg }} />;
}
