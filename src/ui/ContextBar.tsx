import type { ReactElement } from "react";
import { useMapStore } from "../store/map-store";
import type { RoutingProfile } from "../core/routing/itinerary";

/** Sous-barre contextuelle : options du mode Dessin, ou aide du mode Édition. */
export function ContextBar(): ReactElement | null {
  const drawMode = useMapStore((s) => s.drawMode);
  const editMode = useMapStore((s) => s.editMode);
  const poiMode = useMapStore((s) => s.poiMode);
  const freehand = useMapStore((s) => s.freehand);
  const setFreehand = useMapStore((s) => s.setFreehand);
  const routing = useMapStore((s) => s.routing);
  const setRouting = useMapStore((s) => s.setRouting);
  const routingProfile = useMapStore((s) => s.routingProfile);
  const setRoutingProfile = useMapStore((s) => s.setRoutingProfile);
  const routingBusy = useMapStore((s) => s.routingBusy);

  if (!drawMode && !editMode && !poiMode) return null;

  if (poiMode) {
    return (
      <div className="contextbar">
        <span className="context-mode">📍 Points d'intérêt</span>
        <span className="context-hint">
          Cliquer sur la carte = poser un POI · glisser un POI = déplacer · clic =
          éditer · Échap = quitter
        </span>
      </div>
    );
  }

  if (editMode) {
    return (
      <div className="contextbar">
        <span className="context-mode">✎ Édition</span>
        <span className="context-hint">
          Glisser un sommet · clic milieu = insérer · sommet puis Suppr = supprimer ·
          Échap = quitter
        </span>
      </div>
    );
  }

  return (
    <div className="contextbar">
      <span className="context-mode">✏ Dessin</span>
      <label>
        <input
          type="checkbox"
          checked={freehand}
          onChange={(e) => {
            const on = e.currentTarget.checked;
            setFreehand(on);
            if (on) setRouting(false);
          }}
        />
        freehand
      </label>
      <label>
        <input
          type="checkbox"
          checked={routing}
          onChange={(e) => {
            const on = e.currentTarget.checked;
            setRouting(on);
            if (on) setFreehand(false);
          }}
        />
        suivre les sentiers
      </label>
      {routing && (
        <select
          value={routingProfile}
          onChange={(e) => setRoutingProfile(e.currentTarget.value as RoutingProfile)}
          title="Profil de routage"
        >
          <option value="pedestrian">à pied</option>
          <option value="car">voiture</option>
        </select>
      )}
      <span className="context-hint">
        {routingBusy
          ? "calcul…"
          : routing
            ? "Cliquer les points d'ancrage · Échap = terminer"
            : freehand
              ? "Glisser pour tracer · Échap = terminer"
              : "Cliquer pour ajouter des points · Échap = terminer"}
      </span>
    </div>
  );
}
