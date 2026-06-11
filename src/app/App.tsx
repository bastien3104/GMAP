import type { ReactElement } from "react";
import { MapView } from "../map/MapView";
import { MenuBar } from "../ui/MenuBar";
import { ContextBar } from "../ui/ContextBar";
import { LayersPanel } from "../ui/LayersPanel";
import { ProfilePanel } from "../ui/ProfilePanel";
import { WaypointEditor } from "../ui/WaypointEditor";
import { SearchBox } from "../ui/SearchBox";
import { DownloadDialog } from "../ui/DownloadDialog";
import { SplitDialog } from "../ui/SplitDialog";
import { SimplifyDialog } from "../ui/SimplifyDialog";
import { SmoothDialog } from "../ui/SmoothDialog";
import { ShortcutsHelp } from "../ui/ShortcutsHelp";
import { useEditorShortcuts } from "../ui/useEditorShortcuts";
import { useTheme } from "../ui/useTheme";
import "./app.css";

/**
 * Composition racine : interface ancrée en régions (plus d'encarts flottants).
 * Barre de menus en haut + sous-barre contextuelle ; rangée [Calques | carte] ;
 * dock profil en bas ; dialogues en surcouche.
 */
export function App(): ReactElement {
  useTheme();
  useEditorShortcuts();
  return (
    <div className="app-shell">
      <MenuBar />
      <ContextBar />
      <div className="app-body">
        <LayersPanel />
        <div className="map-region">
          <MapView />
          <SearchBox />
          <WaypointEditor />
        </div>
      </div>
      <ProfilePanel />
      <DownloadDialog />
      <SplitDialog />
      <SimplifyDialog />
      <SmoothDialog />
      <ShortcutsHelp />
    </div>
  );
}

export default App;
