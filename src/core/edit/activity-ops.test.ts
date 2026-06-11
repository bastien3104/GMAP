import { describe, expect, it } from "vitest";
import { createEmptyProject, createTrack, type TrackPoint } from "../model";
import { trackTimeBounds, trimTrackTime } from "./activity-ops";

function timedTrack(): { project: ReturnType<typeof createEmptyProject>; id: string } {
  const t0 = Date.parse("2026-06-01T08:00:00Z");
  const points: TrackPoint[] = [];
  for (let i = 0; i < 10; i++) {
    points.push({
      lat: 45 + i * 0.001,
      lon: 6,
      time: new Date(t0 + i * 60_000).toISOString(),
    });
  }
  const track = createTrack({ segments: [points] });
  const project = createEmptyProject("P");
  project.tracks.push(track);
  return { project, id: track.id };
}

describe("trackTimeBounds", () => {
  it("renvoie les bornes temporelles, ou null sans horodatage", () => {
    const { project, id } = timedTrack();
    const bounds = trackTimeBounds(project.tracks.find((t) => t.id === id)!);
    expect(bounds).not.toBeNull();
    expect(bounds!.end - bounds!.start).toBe(540);

    const mute = createTrack({ segments: [[{ lat: 45, lon: 6 }]] });
    expect(trackTimeBounds(mute)).toBeNull();
  });
});

describe("trimTrackTime", () => {
  it("supprime les points hors fenêtre (début et fin)", () => {
    const { project, id } = timedTrack();
    // Coupe 2 min au début et 1 min à la fin → garde les points 2..8 (7 points).
    const next = trimTrackTime(project, id, 120, 60);
    const track = next.tracks[0]!;
    expect(track.segments[0]).toHaveLength(7);
    expect(track.segments[0]![0]!.time).toBe("2026-06-01T08:02:00.000Z");
    expect(track.segments[0]![6]!.time).toBe("2026-06-01T08:08:00.000Z");
    // Immutabilité : le projet d'origine est intact.
    expect(project.tracks[0]!.segments[0]).toHaveLength(10);
  });

  it("ne fait rien si recadrage nul, trace muette ou fenêtre vide", () => {
    const { project, id } = timedTrack();
    expect(trimTrackTime(project, id, 0, 0)).toBe(project);
    expect(trimTrackTime(project, "absent", 60, 0)).toBe(project);
    // Fenêtre vide (tout couper) → inchangé.
    expect(trimTrackTime(project, id, 600, 600)).toBe(project);
  });

  it("conserve les points sans horodatage", () => {
    const t0 = Date.parse("2026-06-01T08:00:00Z");
    const points: TrackPoint[] = [
      { lat: 45, lon: 6, time: new Date(t0).toISOString() },
      { lat: 45.001, lon: 6 }, // sans temps : conservé
      { lat: 45.002, lon: 6, time: new Date(t0 + 60_000).toISOString() },
      { lat: 45.003, lon: 6, time: new Date(t0 + 120_000).toISOString() },
    ];
    const track = createTrack({ segments: [points] });
    const project = createEmptyProject("P");
    project.tracks.push(track);
    const next = trimTrackTime(project, track.id, 30, 0);
    expect(next.tracks[0]!.segments[0]).toHaveLength(3);
    expect(next.tracks[0]!.segments[0]![0]!.time).toBeUndefined();
  });
});
