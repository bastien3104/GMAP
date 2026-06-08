import { describe, it, expect } from "vitest";
import {
  lonLatToTileXY,
  tileCount,
  tileCountForZoom,
  tileRangeForBbox,
  tmsRow,
  type Bbox,
} from "./tile-math";

const WORLD: Bbox = { minLon: -179, minLat: -85, maxLon: 179, maxLat: 85 };

describe("lonLatToTileXY", () => {
  it("z0 : tout tombe dans la tuile unique (0,0)", () => {
    expect(lonLatToTileXY(0, 2.35, 48.85)).toEqual({ x: 0, y: 0 });
    expect(lonLatToTileXY(0, -120, -30)).toEqual({ x: 0, y: 0 });
  });

  it("z1 : quadrants corrects", () => {
    expect(lonLatToTileXY(1, -90, 45)).toEqual({ x: 0, y: 0 }); // NO
    expect(lonLatToTileXY(1, 90, 45)).toEqual({ x: 1, y: 0 }); // NE
    expect(lonLatToTileXY(1, -90, -45)).toEqual({ x: 0, y: 1 }); // SO
    expect(lonLatToTileXY(1, 90, -45)).toEqual({ x: 1, y: 1 }); // SE
  });

  it("x croît avec la longitude, y décroît avec la latitude", () => {
    const z = 8;
    const a = lonLatToTileXY(z, 0, 45);
    const b = lonLatToTileXY(z, 10, 45);
    expect(b.x).toBeGreaterThan(a.x);
    const north = lonLatToTileXY(z, 5, 50);
    const south = lonLatToTileXY(z, 5, 40);
    expect(south.y).toBeGreaterThan(north.y);
  });

  it("borne les indices dans [0, 2^z - 1]", () => {
    const z = 5;
    const max = 2 ** z - 1;
    const t = lonLatToTileXY(z, 200, 95);
    expect(t.x).toBeLessThanOrEqual(max);
    expect(t.y).toBeLessThanOrEqual(max);
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.y).toBeGreaterThanOrEqual(0);
  });
});

describe("tileRangeForBbox / tileCount", () => {
  it("z0 : une seule tuile pour le monde", () => {
    expect(tileCountForZoom(WORLD, 0)).toBe(1);
    expect(tileRangeForBbox(WORLD, 0)).toEqual({
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    });
  });

  it("compte = produit des étendues X et Y", () => {
    const bbox: Bbox = { minLon: 6.0, minLat: 45.0, maxLon: 7.0, maxLat: 46.0 };
    const z = 12;
    const r = tileRangeForBbox(bbox, z);
    const expected = (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1);
    expect(tileCountForZoom(bbox, z)).toBe(expected);
  });

  it("somme sur la plage de zooms", () => {
    const bbox: Bbox = { minLon: 6.0, minLat: 45.0, maxLon: 6.5, maxLat: 45.5 };
    const sum =
      tileCountForZoom(bbox, 10) +
      tileCountForZoom(bbox, 11) +
      tileCountForZoom(bbox, 12);
    expect(tileCount(bbox, 10, 12)).toBe(sum);
  });
});

describe("tmsRow", () => {
  it("inverse l'axe y (TMS)", () => {
    expect(tmsRow(0, 0)).toBe(0);
    expect(tmsRow(1, 0)).toBe(1);
    expect(tmsRow(1, 1)).toBe(0);
    expect(tmsRow(2, 1)).toBe(2);
  });
});
