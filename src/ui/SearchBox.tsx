import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { geocodeSearch, type GeocodeResult } from "../core/geocode/geocode";
import { createWaypoint } from "../core/model";
import { useProjectStore } from "../store/project-store";
import { useUiStore } from "../store/ui-store";
import { flyTo } from "../map/map-ref";
import { IconClose, IconPin, IconSearch } from "./icons";

/** Délai de debounce (ms) avant déclenchement de la recherche. */
const DEBOUNCE_MS = 300;

/**
 * Barre de recherche flottante (géocodage Géoplateforme).
 *
 * Masquée par défaut : visible uniquement quand `ui-store.searchOpen` est vrai (ouverte
 * via Ctrl+F ou le menu Outils). Choisir un résultat recentre la carte (ou pose un POI)
 * **et referme** la barre. Échec réseau = message discret (dégradation gracieuse).
 */
export function SearchBox(): ReactElement | null {
  const open = useUiStore((s) => s.searchOpen);
  const setOpen = useUiStore((s) => s.setSearchOpen);
  const addWaypoint = useProjectStore((s) => s.addWaypoint);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const reqId = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus automatique à l'ouverture.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Recherche débouncée.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setError(false);
      return;
    }
    const id = ++reqId.current;
    setBusy(true);
    const timer = window.setTimeout(() => {
      void geocodeSearch(q)
        .then((res) => {
          if (id !== reqId.current) return; // réponse périmée
          setResults(res);
          setError(false);
          setShowResults(true);
        })
        .catch(() => {
          if (id !== reqId.current) return;
          setResults([]);
          setError(true);
          setShowResults(true);
        })
        .finally(() => {
          if (id === reqId.current) setBusy(false);
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  if (!open) return null;

  /** Referme la barre et remet l'état à zéro. */
  function close(): void {
    setOpen(false);
    setQuery("");
    setResults([]);
    setShowResults(false);
    setError(false);
  }

  function recenter(r: GeocodeResult): void {
    flyTo(r.lon, r.lat);
    close();
  }

  function dropPoi(r: GeocodeResult): void {
    addWaypoint(createWaypoint({ lat: r.lat, lon: r.lon, name: r.label }));
    flyTo(r.lon, r.lat);
    close();
  }

  return (
    <div className="searchbox">
      <div className="searchbox-input">
        <span className="searchbox-icon">
          <IconSearch size={15} />
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher un lieu, une adresse…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              close();
            } else if (e.key === "Enter" && results[0] !== undefined) {
              recenter(results[0]);
            }
          }}
        />
        <button
          type="button"
          className="searchbox-clear"
          title="Fermer (Échap)"
          onClick={close}
        >
          <IconClose size={14} />
        </button>
      </div>

      {showResults && (
        <ul className="searchbox-results">
          {busy && <li className="searchbox-msg">Recherche…</li>}
          {!busy && error && (
            <li className="searchbox-msg">Service indisponible (hors-ligne ?)</li>
          )}
          {!busy && !error && results.length === 0 && (
            <li className="searchbox-msg">Aucun résultat.</li>
          )}
          {results.map((r, i) => (
            <li key={`${r.lon},${r.lat},${i}`} className="searchbox-result">
              <button
                type="button"
                className="searchbox-label"
                onClick={() => recenter(r)}
                title="Recentrer la carte"
              >
                {r.label}
                {r.type !== undefined && <span className="searchbox-type"> · {r.type}</span>}
              </button>
              <button
                type="button"
                className="searchbox-pin"
                onClick={() => dropPoi(r)}
                title="Poser un point d'intérêt ici"
              >
                <IconPin size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
