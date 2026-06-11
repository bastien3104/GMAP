import { describe, it, expect } from "vitest";
import { createEmptyProject, createWaypoint, type Project } from "../model";
import {
  addWaypoint,
  moveWaypoint,
  removeWaypoint,
  updateWaypoint,
} from "./waypoint-ops";

function projectWithOne(): { project: Project; id: string } {
  const wpt = createWaypoint({ lat: 45, lon: 6, name: "Col" });
  const project = addWaypoint(createEmptyProject(), wpt);
  return { project, id: wpt.id };
}

describe("addWaypoint", () => {
  it("ajoute un waypoint sans muter l'original", () => {
    const base = createEmptyProject();
    const next = addWaypoint(base, createWaypoint({ lat: 45, lon: 6 }));
    expect(base.waypoints).toHaveLength(0);
    expect(next.waypoints).toHaveLength(1);
    expect(next).not.toBe(base);
  });
});

describe("updateWaypoint", () => {
  it("modifie nom/note/symbole/altitude du bon waypoint", () => {
    const { project, id } = projectWithOne();
    const next = updateWaypoint(project, id, {
      name: "Sommet",
      note: "vue",
      symbol: "summit",
      ele: 2100,
    });
    const wpt = next.waypoints[0]!;
    expect(wpt.name).toBe("Sommet");
    expect(wpt.note).toBe("vue");
    expect(wpt.symbol).toBe("summit");
    expect(wpt.ele).toBe(2100);
  });

  it("ignore les champs absents du patch", () => {
    const { project, id } = projectWithOne();
    const next = updateWaypoint(project, id, { note: "abc" });
    expect(next.waypoints[0]!.name).toBe("Col");
  });

  it("renvoie le même projet si l'id est inconnu", () => {
    const { project } = projectWithOne();
    expect(updateWaypoint(project, "absent", { name: "X" })).toBe(project);
  });
});

describe("moveWaypoint", () => {
  it("repositionne le waypoint en préservant les autres champs", () => {
    const { project, id } = projectWithOne();
    const next = moveWaypoint(project, id, 7, 46);
    const wpt = next.waypoints[0]!;
    expect(wpt.lon).toBe(7);
    expect(wpt.lat).toBe(46);
    expect(wpt.name).toBe("Col");
  });

  it("renvoie le même projet si l'id est inconnu", () => {
    const { project } = projectWithOne();
    expect(moveWaypoint(project, "absent", 0, 0)).toBe(project);
  });
});

describe("removeWaypoint", () => {
  it("supprime le waypoint ciblé", () => {
    const { project, id } = projectWithOne();
    expect(removeWaypoint(project, id).waypoints).toHaveLength(0);
  });

  it("renvoie le même projet si l'id est inconnu", () => {
    const { project } = projectWithOne();
    expect(removeWaypoint(project, "absent")).toBe(project);
  });
});
