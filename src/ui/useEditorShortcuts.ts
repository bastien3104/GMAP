import { useEffect } from "react";
import { useProjectStore } from "../store/project-store";

/**
 * Raccourcis clavier de l'éditeur : Ctrl/Cmd+Z (annuler),
 * Ctrl/Cmd+Y ou Ctrl/Cmd+Maj+Z (rétablir). Ignoré dans les champs de saisie.
 */
export function useEditorShortcuts(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable === true) {
        return;
      }
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        useProjectStore.getState().undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        useProjectStore.getState().redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
