import type { ReactElement } from "react";
import { useUiStore } from "../store/ui-store";

/** Liste des raccourcis affichés dans l'aide (libellé → touches). */
const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
  { keys: "Ctrl + O", label: "Ouvrir des fichiers GPX" },
  { keys: "Ctrl + E", label: "Exporter en GPX" },
  { keys: "Ctrl + F", label: "Rechercher un lieu" },
  { keys: "Ctrl + Z", label: "Annuler" },
  { keys: "Ctrl + Y", label: "Rétablir" },
  { keys: "D", label: "Mode dessin d'une trace" },
  { keys: "E", label: "Mode édition des points (trace sélectionnée)" },
  { keys: "P", label: "Mode points d'intérêt" },
  { keys: "Suppr", label: "Supprimer le sommet / le POI sélectionné" },
  { keys: "Échap", label: "Quitter le mode courant / fermer" },
  { keys: "?", label: "Afficher cette aide" },
];

/** Dialogue d'aide listant les raccourcis clavier. */
export function ShortcutsHelp(): ReactElement | null {
  const open = useUiStore((s) => s.helpOpen);
  const setOpen = useUiStore((s) => s.setHelpOpen);

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={() => setOpen(false)}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>Raccourcis clavier</span>
          <button type="button" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <table className="shortcuts-table">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys}>
                <td>
                  <kbd>{s.keys}</kbd>
                </td>
                <td>{s.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
