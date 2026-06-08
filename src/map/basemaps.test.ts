import { describe, it, expect } from "vitest";
import { BASEMAPS, DEFAULT_BASEMAP_ID, PLAN_IGN, getBasemap } from "./basemaps";
import { buildRasterStyle } from "./map-style";

describe("basemaps", () => {
  it("expose le Plan IGN comme fond par défaut", () => {
    expect(DEFAULT_BASEMAP_ID).toBe(PLAN_IGN.id);
    expect(getBasemap(DEFAULT_BASEMAP_ID)).toBe(PLAN_IGN);
  });

  it("retourne undefined pour un fond inconnu", () => {
    expect(getBasemap("inconnu")).toBeUndefined();
  });

  it("chaque fond a une attribution non vide (conformité licence)", () => {
    for (const b of BASEMAPS) {
      expect(b.attribution.trim().length).toBeGreaterThan(0);
    }
  });

  it("l'URL Plan IGN utilise le WMTS PLANIGNV2 en TileMatrixSet PM", () => {
    const url = PLAN_IGN.tiles[0] ?? "";
    expect(url).toContain("LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2");
    expect(url).toContain("TILEMATRIXSET=PM");
    expect(url).toContain("{z}");
    expect(url).toContain("{x}");
    expect(url).toContain("{y}");
  });
});

describe("buildRasterStyle", () => {
  it("produit un style v8 avec une source et une couche raster", () => {
    const style = buildRasterStyle(PLAN_IGN);
    expect(style.version).toBe(8);
    const sourceIds = Object.keys(style.sources);
    expect(sourceIds).toHaveLength(1);
    expect(style.layers).toHaveLength(1);
    const layer = style.layers[0];
    expect(layer?.type).toBe("raster");
  });
});
