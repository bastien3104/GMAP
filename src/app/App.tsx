import type { ReactElement } from "react";
import { MapView } from "../map/MapView";
import "./app.css";

/**
 * Composition racine de l'application.
 *
 * Phase 0 : carte plein écran. Le layout complet (panneau latéral rétractable,
 * barre d'outils, profil altimétrique dockable) sera introduit dans les phases
 * suivantes.
 */
export function App(): ReactElement {
  return (
    <div className="app-shell">
      <MapView />
    </div>
  );
}

export default App;
