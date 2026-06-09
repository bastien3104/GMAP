import { describe, it, expect } from "vitest";
import { createEmptyProject } from "../model";
import {
  addTrack,
  appendPoint,
  appendPoints,
  createDrawingTrack,
} from "./draw-ops";

describe("draw-ops", () => {
  it("crée une trace de dessin vide (un segment, kind track)", () => {
    const track = createDrawingTrack();
    expect(track.kind).toBe("track");
    expect(track.segments).toHaveLength(1);
    expect(track.segments[0]).toHaveLength(0);
    expect(track.visible).toBe(true);
  });

  it("ajoute une trace au projet sans muter l'original", () => {
    const p = createEmptyProject();
    const next = addTrack(p, createDrawingTrack());
    expect(next.tracks).toHaveLength(1);
    expect(p.tracks).toHaveLength(0);
  });

  it("ajoute un point au dernier segment", () => {
    const track = createDrawingTrack();
    const p = addTrack(createEmptyProject(), track);
    const next = appendPoint(p, track.id, { lon: 6, lat: 45 });
    expect(next.tracks[0]!.segments[0]).toHaveLength(1);
    expect(next.tracks[0]!.segments[0]![0]).toEqual({ lon: 6, lat: 45 });
  });

  it("ajoute plusieurs points en une fois (freehand)", () => {
    const track = createDrawingTrack();
    const p = addTrack(createEmptyProject(), track);
    const next = appendPoints(p, track.id, [
      { lon: 6, lat: 45 },
      { lon: 6.1, lat: 45.1 },
      { lon: 6.2, lat: 45.2 },
    ]);
    expect(next.tracks[0]!.segments[0]).toHaveLength(3);
  });

  it("appendPoints sans point renvoie le même projet", () => {
    const track = createDrawingTrack();
    const p = addTrack(createEmptyProject(), track);
    expect(appendPoints(p, track.id, [])).toBe(p);
  });
});
