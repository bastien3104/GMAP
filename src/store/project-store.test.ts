import { beforeEach, describe, it, expect } from "vitest";
import { createTrack, type Project } from "../core/model";
import { useProjectStore } from "./project-store";

function sampleProject(): Project {
  return {
    id: "p",
    name: "Test",
    tracks: [createTrack({ name: "A" }), createTrack({ name: "B" })],
    waypoints: [],
  };
}

beforeEach(() => {
  useProjectStore.setState({
    project: null,
    past: [],
    future: [],
    selectedTrackId: null,
  });
});

describe("project-store — undo/redo", () => {
  it("loadProject réinitialise l'historique", () => {
    const store = useProjectStore.getState();
    store.loadProject(sampleProject());
    const s = useProjectStore.getState();
    expect(s.project?.tracks).toHaveLength(2);
    expect(s.past).toHaveLength(0);
    expect(s.future).toHaveLength(0);
  });

  it("une édition empile le passé puis s'annule et se rétablit", () => {
    const store = useProjectStore.getState();
    store.loadProject(sampleProject());
    const id = useProjectStore.getState().project!.tracks[0]!.id;

    useProjectStore.getState().renameTrack(id, "Renommée");
    expect(useProjectStore.getState().project!.tracks[0]!.name).toBe("Renommée");
    expect(useProjectStore.getState().past).toHaveLength(1);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project!.tracks[0]!.name).toBe("A");
    expect(useProjectStore.getState().future).toHaveLength(1);

    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project!.tracks[0]!.name).toBe("Renommée");
    expect(useProjectStore.getState().future).toHaveLength(0);
  });

  it("une nouvelle édition vide la pile de rétablissement", () => {
    const store = useProjectStore.getState();
    store.loadProject(sampleProject());
    const id = useProjectStore.getState().project!.tracks[0]!.id;
    useProjectStore.getState().setTrackColor(id, "#abcdef");
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().future).toHaveLength(1);
    useProjectStore.getState().setTrackColor(id, "#123456");
    expect(useProjectStore.getState().future).toHaveLength(0);
  });

  it("supprimer la trace sélectionnée la désélectionne", () => {
    const store = useProjectStore.getState();
    store.loadProject(sampleProject());
    const id = useProjectStore.getState().project!.tracks[0]!.id;
    useProjectStore.getState().selectTrack(id);
    useProjectStore.getState().deleteTrack(id);
    expect(useProjectStore.getState().selectedTrackId).toBeNull();
    expect(useProjectStore.getState().project!.tracks).toHaveLength(1);
  });

  it("undo/redo sans historique ne fait rien", () => {
    const store = useProjectStore.getState();
    store.loadProject(sampleProject());
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project!.tracks).toHaveLength(2);
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project!.tracks).toHaveLength(2);
  });
});
