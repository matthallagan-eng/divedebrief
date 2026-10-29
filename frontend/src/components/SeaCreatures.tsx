// The background scene, drawn in assets/sea/scene/*.svg. The creatures face
// right; the scene sets their size and opacity.

import { SCENE_DRAWINGS } from "./creatures/drawings";
import { DrawingView } from "./creatures/DrawingView";

export const Fish = () => <DrawingView drawing={SCENE_DRAWINGS.fish} />;
export const Shark = () => <DrawingView drawing={SCENE_DRAWINGS.shark} />;
export const Whale = () => <DrawingView drawing={SCENE_DRAWINGS.whale} />;
export const Lobster = () => <DrawingView drawing={SCENE_DRAWINGS.lobster} />;
export const Shipwreck = () => <DrawingView drawing={SCENE_DRAWINGS.shipwreck} />;
/** Rocks, coral and sea grass along the bottom of the screen. */
export const Reef = () => <DrawingView drawing={SCENE_DRAWINGS.reef} />;
