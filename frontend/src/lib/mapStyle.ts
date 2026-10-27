import type { ExpressionSpecification, LayerSpecification } from "maplibre-gl";

// Vector tiles from OpenStreetMap data, free and keyless. Unlike the raster
// tiles, whose labels are drawn into the image in each country's own script,
// their labels are text the map renders, so they can be shown translated.
export const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** The viewer's language, e.g. "en" for en-US. */
export function labelLanguage(): string {
  return (navigator.language || "en").split("-")[0].toLowerCase();
}

/**
 * A place's name in the language, then English, then spelled in Latin letters.
 * A name only written in another script (OpenMapTiles marks those with
 * name:nonlatin) is left off rather than shown in characters the diver can't read.
 */
export function localName(lang: string): ExpressionSpecification {
  return [
    "coalesce",
    ["get", `name:${lang}`],
    ["get", "name:en"],
    ["get", "name:latin"],
    ["case", ["has", "name:nonlatin"], "", ["get", "name"]],
  ];
}

/** The style's layers with every name label in the language; road numbers are left alone. */
export function localizeLabels(layers: LayerSpecification[], lang: string): LayerSpecification[] {
  return layers.map((layer) => {
    if (layer.type !== "symbol" || !layer.layout?.["text-field"]) return layer;
    if (!JSON.stringify(layer.layout["text-field"]).includes('"name')) return layer;
    return { ...layer, layout: { ...layer.layout, "text-field": localName(lang) } };
  });
}
