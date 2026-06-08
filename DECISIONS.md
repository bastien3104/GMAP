# DECISIONS.md — journal des décisions techniques

> Chaque décision non triviale, datée, en 1-2 lignes.

## 2026-06-08 — Phase 0 (Bootstrap)
- **Stack conforme au prompt** : Tauri 2 + React + TS + Vite + MapLibre GL JS,
  gestionnaire `pnpm`, toolchain Rust MSVC. Aucun écart de stack.
- **Toolchain Windows** : Rust installé via rustup (`stable-x86_64-pc-windows-msvc`),
  VS Build Tools 2022 (workload C++ + Windows 11 SDK) requis pour lier. Chaîne validée
  par un `cargo build` témoin (compile + lien + exécution OK).
- **pnpm** : installé en global npm (`Roaming\npm`) — `corepack` indisponible (pas de
  droits admin pour écrire dans `Program Files\nodejs`).
- **Scaffolding** : `create-tauri-app` (template `react-ts`) puis restructuration vers
  l'architecture cible (`src/app`, `src/map`, `src/core`, …).
- **Identité app** : productName `GMAP`, identifier `com.gmap.app`, fenêtre 1280×800.
- **Fonds de carte en WMTS raster** (pas WFS/WMS-V) : évolution Géoplateforme annoncée
  mi-2026 ; le WMTS reste stable. Plan IGN = `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2`,
  TileMatrixSet `PM`, identifiants confirmés via `GetCapabilities`.
- **TypeScript** : `strict` + `noUncheckedIndexedAccess` activés.
- **Tests** : Vitest, environnement `node`, ciblant les fonctions pures
  `src/**/*.test.ts` (model, basemaps, map-style).
- **Réglages pnpm 10/11** : `onlyBuiltDependencies: [esbuild]` + `verifyDepsBeforeRun:
  false` + `dangerouslyAllowAllBuilds: true` dans `pnpm-workspace.yaml`. Nécessaire car
  le garde-fou « ignored build scripts » de pnpm faisait échouer `install` et tous les
  scripts (binaire natif esbuild requis par Vite). À resserrer si pnpm corrige le
  respect de `onlyBuiltDependencies` seul.
