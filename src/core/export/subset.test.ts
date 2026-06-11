import { describe, it, expect } from "vitest";
import { createTrack, createWaypoint, type Project } from "../model";
import { subsetProject } from "./subset";

function sample(): Project {
  const a = createTrack({ name: "A" });
  const b = createTrack({ name: "B" });
  return {
    id: "p",
    name: "Projet",
    tracks: [a, b],
    waypoints: [createWaypoint({ lat: 45, lon: 6, name: "POI" })],
  };
}

describe("subsetProject", () => {
  it("ne garde que les traces sélectionnées", () => {
    const p = sample();
    const out = subsetProject(p, [p.tracks[0]!.id], true);
    expect(out.tracks).toHaveLength(1);
    expect(out.tracks[0]!.name).toBe("A");
  });

  it("exclut les waypoints si demandé", () => {
    const p = sample();
    const out = subsetProject(p, [p.tracks[0]!.id], false);
    expect(out.waypoints).toHaveLength(0);
  });

  it("garde les waypoints si demandé", () => {
    const p = sample();
    expect(subsetProject(p, [], true).waypoints).toHaveLength(1);
  });

  it("ne mute pas l'original", () => {
    const p = sample();
    subsetProject(p, [p.tracks[0]!.id], false);
    expect(p.tracks).toHaveLength(2);
    expect(p.waypoints).toHaveLength(1);
  });
});
