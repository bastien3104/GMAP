import type { ReactElement } from "react";
import { MapView } from "../map/MapView";
import { MenuBar } from "../ui/MenuBar";
import { ContextBar } from "../ui/ContextBar";
import { LayersPanel } from "../ui/LayersPanel";
import { ProfilePanel } from "../ui/ProfilePanel";
import { DownloadDialog } from "../ui/DownloadDialog";
import { useEditorShortcuts } from "../ui/useEditorShortcuts";
import "./app.css";

/**
 * Composition racine : interface ancrée en régions (plus d'encarts flottants).
 * Barre de menus en haut + sous-barre contextuelle ; rangée [Calques | carte] ;
 * dock profil en bas ; dialogues en surcouche.
 */
export function App(): ReactElement {
  useEditorShortcuts();
  return (
    <div className="app-shell">
      <MenuBar />
      <ContextBar />
      <div className="app-body">
        <LayersPanel />
        <div className="map-region">
          <MapView />
        </div>
      </div>
      <ProfilePanel />
      <DownloadDialog />
    </div>
  );
}

export default App;
