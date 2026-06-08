import { describe, it, expect } from "vitest";
import {
  BASEMAPS,
  DEFAULT_BASEMAP_ID,
  ORTHO_IGN,
  OPENTOPOMAP,
  OSM,
  PLAN_IGN,
  getBasemap,
} from "./basemaps";
import { buildRasterStyle } from "./map-style";

describe("basemaps", () => {
  it("expose le Plan IGN comme fond par défaut", () => {
    expect(DEFAULT_BASEMAP_ID).toBe(PLAN_IGN.id);
    expect(getBasemap(DEFAULT_BASEMAP_ID)).toBe(PLAN_IGN);
  });

  it("propose Plan IGN, Ortho, OpenTopoMap et OSM", () => {
    expect(BASEMAPS).toHaveLength(4);
    const ids = BASEMAPS.map((b) => b.id);
    expect(ids).toEqual([PLAN_IGN.id, ORTHO_IGN.id, OPENTOPOMAP.id, OSM.id]);
  });

  it("retourne undefined pour un fond inconnu", () => {
    expect(getBasemap("inconnu")).toBeUndefined();
  });

  it("chaque fond a une attribution non vide et des URLs {z}/{x}/{y}", () => {
    for (const b of BASEMAPS) {
      expect(b.attribution.trim().length).toBeGreaterThan(0);
      expect(b.tiles.length).toBeGreaterThan(0);
      for (const url of b.tiles) {
        expect(url).toContain("{z}");
        expect(url).toContain("{x}");
        expect(url).toContain("{y}");
      }
    }
  });

  it("l'URL Plan IGN utilise le WMTS PLANIGNV2 en TileMatrixSet PM", () => {
    const url = PLAN_IGN.tiles[0] ?? "";
    expect(url).toContain("LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2");
    expect(url).toContain("TILEMATRIXSET=PM");
  });

  it("l'Ortho IGN est en JPEG sur la couche ORTHOPHOTOS", () => {
    const url = ORTHO_IGN.tiles[0] ?? "";
    expect(url).toContain("LAYER=ORTHOIMAGERY.ORTHOPHOTOS");
    expect(url).toContain("FORMAT=image/jpeg");
  });

  it("OpenTopoMap fournit plusieurs sous-domaines", () => {
    expect(OPENTOPOMAP.tiles.length).toBeGreaterThan(1);
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
