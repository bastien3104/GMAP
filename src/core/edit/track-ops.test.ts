import { describe, it, expect } from "vitest";
import { createTrack, type Project } from "../model";
import {
  moveTrack,
  removeTrack,
  renameTrack,
  setTrackColor,
  setTrackVisibility,
} from "./track-ops";

function sampleProject(): Project {
  return {
    id: "p",
    name: "Test",
    tracks: [
      createTrack({ name: "A", color: "#111111" }),
      createTrack({ name: "B", color: "#222222" }),
      createTrack({ name: "C", color: "#333333" }),
    ],
    waypoints: [],
  };
}

describe("track-ops", () => {
  it("renomme une trace sans muter l'original (partage de structure)", () => {
    const p = sampleProject();
    const id = p.tracks[1]!.id;
    const next = renameTrack(p, id, "Nouveau");
    expect(next.tracks[1]?.name).toBe("Nouveau");
    expect(p.tracks[1]?.name).toBe("B"); // original intact
    expect(next.tracks[0]).toBe(p.tracks[0]); // trace non touchée partagée
    expect(next).not.toBe(p);
  });

  it("change couleur et visibilité", () => {
    const p = sampleProject();
    const id = p.tracks[0]!.id;
    expect(setTrackColor(p, id, "#abcdef").tracks[0]?.color).toBe("#abcdef");
    expect(setTrackVisibility(p, id, false).tracks[0]?.visible).toBe(false);
  });

  it("supprime une trace", () => {
    const p = sampleProject();
    const id = p.tracks[1]!.id;
    const next = removeTrack(p, id);
    expect(next.tracks).toHaveLength(2);
    expect(next.tracks.find((t) => t.id === id)).toBeUndefined();
  });

  it("réordonne (up/down) et borne aux extrémités", () => {
    const p = sampleProject();
    const ids = p.tracks.map((t) => t.id);
    const up = moveTrack(p, ids[1]!, "up");
    expect(up.tracks.map((t) => t.id)).toEqual([ids[1], ids[0], ids[2]]);
    const down = moveTrack(p, ids[1]!, "down");
    expect(down.tracks.map((t) => t.id)).toEqual([ids[0], ids[2], ids[1]]);
    // bornes : pas de changement
    expect(moveTrack(p, ids[0]!, "up").tracks.map((t) => t.id)).toEqual(ids);
    expect(moveTrack(p, ids[2]!, "down").tracks.map((t) => t.id)).toEqual(ids);
  });

  it("ignore un identifiant inconnu", () => {
    const p = sampleProject();
    expect(renameTrack(p, "inconnu", "X")).toEqual(p);
    expect(moveTrack(p, "inconnu", "up")).toBe(p);
  });
});
