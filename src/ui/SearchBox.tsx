import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { geocodeSearch, type GeocodeResult } from "../core/geocode/geocode";
import { createWaypoint } from "../core/model";
import { useProjectStore } from "../store/project-store";
import { flyTo } from "../map/map-ref";

/** Délai de debounce (ms) avant déclenchement de la recherche. */
const DEBOUNCE_MS = 300;

/**
 * Barre de recherche flottante (géocodage Géoplateforme) : recentre la carte sur un
 * résultat et permet d'y poser un point d'intérêt. Échec réseau = message discret
 * (dégradation gracieuse), jamais de crash.
 */
export function SearchBox(): ReactElement {
  const addWaypoint = useProjectStore((s) => s.addWaypoint);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const reqId = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Ctrl/Cmd+F : focus de la recherche.
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Recherche débouncée.
  useEffect(() => {
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
          setOpen(true);
        })
        .catch(() => {
          if (id !== reqId.current) return;
          setResults([]);
          setError(true);
          setOpen(true);
        })
        .finally(() => {
          if (id === reqId.current) setBusy(false);
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  function recenter(r: GeocodeResult): void {
    flyTo(r.lon, r.lat);
    setOpen(false);
  }

  function dropPoi(r: GeocodeResult): void {
    addWaypoint(createWaypoint({ lat: r.lat, lon: r.lon, name: r.label }));
    flyTo(r.lon, r.lat);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="searchbox">
      <div className="searchbox-input">
        <span className="searchbox-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher un lieu, une adresse…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onFocus={() => {
            if (results.length > 0 || error) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              e.currentTarget.blur();
            } else if (e.key === "Enter" && results[0] !== undefined) {
              recenter(results[0]);
            }
          }}
        />
        {query !== "" && (
          <button
            type="button"
            className="searchbox-clear"
            title="Effacer"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
          >
            ✕
          </button>
        )}
      </div>

      {open && (
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
                📍
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
