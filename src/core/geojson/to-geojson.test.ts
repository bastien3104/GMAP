import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseGpx } from "../gpx/parse-gpx";
import { projectBounds, projectToGeoJSON } from "./to-geojson";

const fixture = readFileSync(
  new URL("../gpx/__fixtures__/sample-mountain.gpx", import.meta.url),
  "utf-8",
);

describe("projectToGeoJSON", () => {
  const project = parseGpx(fixture);
  const fc = projectToGeoJSON(project);

  it("produit une LineString par segment (>= 2 points) + un Point par waypoint", () => {
    const lines = fc.features.filter((f) => f.geometry.type === "LineString");
    const points = fc.features.filter((f) => f.geometry.type === "Point");
    expect(lines).toHaveLength(3); // 2 segments de trace + 1 route
    expect(points).toHaveLength(2); // 2 waypoints
  });

  it("ordonne les coordonnées en [lon, lat]", () => {
    const line = fc.features.find((f) => f.geometry.type === "LineString");
    const coord = line?.geometry.type === "LineString"
      ? line.geometry.coordinates[0]
      : undefined;
    expect(coord).toEqual([6.8694, 45.9237]);
  });

  it("ignore les traces non visibles", () => {
    const hidden = parseGpx(fixture);
    for (const t of hidden.tracks) t.visible = false;
    const fcHidden = projectToGeoJSON(hidden);
    const lines = fcHidden.features.filter((f) => f.geometry.type === "LineString");
    expect(lines).toHaveLength(0);
  });
});

describe("projectBounds", () => {
  it("calcule l'emprise du projet", () => {
    const bounds = projectBounds(parseGpx(fixture));
    expect(bounds).not.toBeNull();
    const [minLon, minLat, maxLon, maxLat] = bounds ?? [0, 0, 0, 0];
    expect(minLon).toBeCloseTo(6.8652);
    expect(maxLon).toBeCloseTo(6.87);
    expect(minLat).toBeCloseTo(45.8326);
    expect(maxLat).toBeCloseTo(45.9237);
  });

  it("retourne null pour un projet vide", () => {
    expect(projectBounds({ id: "x", name: "vide", tracks: [], waypoints: [] })).toBeNull();
  });
});
