import type { ReactElement } from "react";
import { MapView } from "../map/MapView";
import { Toolbar } from "../ui/Toolbar";
import { LayersPanel } from "../ui/LayersPanel";
import { OfflinePanel } from "../ui/OfflinePanel";
import { useEditorShortcuts } from "../ui/useEditorShortcuts";
import "./app.css";

/**
 * Composition racine de l'application.
 *
 * Phase 1 : carte plein écran + barre d'outils flottante (ouvrir / exporter GPX).
 * Le layout complet (panneau latéral rétractable, profil altimétrique dockable)
 * sera introduit dans les phases suivantes.
 */
export function App(): ReactElement {
  useEditorShortcuts();
  return (
    <div className="app-shell">
      <MapView />
      <Toolbar />
      <LayersPanel />
      <OfflinePanel />
    </div>
  );
}

export default App;
