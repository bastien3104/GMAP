import type { ChangeEvent, ReactElement } from "react";
import { BASEMAPS } from "../map/basemaps";
import { useMapStore } from "../store/map-store";

/** Sélecteur de fond de carte (lié au store carte). */
export function BasemapSelector(): ReactElement {
  const activeBasemapId = useMapStore((s) => s.activeBasemapId);
  const setBasemap = useMapStore((s) => s.setBasemap);

  function onChange(event: ChangeEvent<HTMLSelectElement>): void {
    setBasemap(event.currentTarget.value);
  }

  return (
    <label className="basemap-selector">
      Fond&nbsp;:
      <select value={activeBasemapId} onChange={onChange}>
        {BASEMAPS.map((basemap) => (
          <option key={basemap.id} value={basemap.id}>
            {basemap.label}
          </option>
        ))}
      </select>
    </label>
  );
}
