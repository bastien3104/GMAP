import { defineConfig } from "vitest/config";

/**
 * Configuration des tests unitaires (Vitest).
 *
 * Les tests portent sur les fonctions pures de `src/core/**` et `src/map/**`
 * (logique isolée de l'UI et de MapLibre). Environnement `node` : pas de DOM
 * requis pour ces tests.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
