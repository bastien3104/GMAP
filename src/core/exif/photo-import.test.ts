import { describe, it, expect } from "vitest";
import { createTrack, type Track } from "../model";
import { photoToWaypoint, trackPointAtTime } from "./photo-import";

function timedTrack(): Track {
  return createTrack({
    segments: [
      [
        { lon: 6.0, lat: 45.0, ele: 1000, time: "2026-06-11T09:00:00Z" },
        { lon: 6.2, lat: 45.2, ele: 1200, time: "2026-06-11T10:00:00Z" },
      ],
    ],
  });
}

describe("trackPointAtTime", () => {
  it("interpole position et altitude au milieu de l'intervalle", () => {
    const p = trackPointAtTime(timedTrack(), "2026-06-11T09:30:00Z");
    expect(p).not.toBeNull();
    expect(p!.lon).toBeCloseTo(6.1, 6);
    expect(p!.lat).toBeCloseTo(45.1, 6);
    expect(p!.ele).toBeCloseTo(1100, 6);
  });

  it("renvoie null hors de la plage temporelle", () => {
    expect(trackPointAtTime(timedTrack(), "2026-06-11T11:00:00Z")).toBeNull();
  });
});

describe("photoToWaypoint", () => {
  it("crée un POI géolocalisé à partir du GPS EXIF", () => {
    const res = photoToWaypoint("IMG_001.jpg", { lat: 45.5, lon: 6.0, ele: 2000 });
    expect(res.status).toBe("geotagged");
    expect(res.waypoint!.name).toBe("IMG_001");
    expect(res.waypoint!.symbol).toBe("photo");
    expect(res.waypoint!.lat).toBe(45.5);
    expect(res.waypoint!.ele).toBe(2000);
  });

  it("corrèle une photo horodatée sans GPS sur une trace", () => {
    const res = photoToWaypoint(
      "photo.jpg",
      { time: "2026-06-11T09:30:00Z" },
      timedTrack(),
    );
    expect(res.status).toBe("correlated");
    expect(res.waypoint!.lon).toBeCloseTo(6.1, 6);
  });

  it("ignore une photo sans GPS ni horodatage exploitable", () => {
    expect(photoToWaypoint("x.jpg", {}).status).toBe("skipped");
    expect(photoToWaypoint("y.jpg", { time: "2026-06-11T09:30:00Z" }).status).toBe(
      "skipped",
    );
  });
});
