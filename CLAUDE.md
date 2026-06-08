# CLAUDE.md — Règles du projet (app GPX)

## Mission
Application desktop Tauri 2 d'édition et de création de tracés GPX (rando/canoë),
fonctionnant online et offline. Format pivot interne : GeoJSON. Source de vérité
du modèle : `src/core/model.ts`.

## Workflow obligatoire
1. **Plan avant code** : pour toute tâche non triviale, produire d'abord un plan
   court (fichiers touchés, types/structures, risques, impact sur d'autres modules),
   attendre validation, puis implémenter.
2. **Travail par phases** : suivre l'ordre des phases du prompt projet. Ne jamais
   livrer une phase qui ne compile pas ou casse le `tauri dev`.
3. **Pas de changement de stack silencieux** : tout écart à la stack imposée est
   proposé et argumenté avant implémentation.
4. **Périmètre** : ne pas implémenter de fonctionnalité non demandée ; si une idée
   semble utile, la proposer, ne pas l'ajouter d'office.

## Conventions de code
- TypeScript `strict: true`. Pas de `any` sans commentaire justifiant.
- Fonctions de calcul (parsing, stats, simplification, conversions) = **pures et
  testées**, isolées de l'UI et de MapLibre.
- React : composants fonctionnels, hooks ; pas de logique métier dans les composants
  (elle va dans `core/` et `store/`).
- State global via Zustand ; l'historique undo/redo est centralisé, toute mutation
  du modèle passe par une action enregistrable.
- Rust (`src-tauri`) : minimal, limité aux capacités natives (sidecars, serveur de
  tuiles, accès FS). Pas de logique métier dupliquée côté Rust.
- Nommage : fichiers `kebab-case`, types/composants `PascalCase`, fonctions/vars
  `camelCase`. Commentaires et UI en français, code/identifiants en anglais.

## Données & robustesse
- Import GPX tolérant aux fichiers malformés (ne jamais crasher : remonter une erreur
  claire). Conserver `ele` et `time` quand présents.
- Toute opération d'édition doit être **réversible** (undo/redo).
- Réseau : toujours prévoir le chemin offline ; échec réseau = dégradation gracieuse,
  jamais un crash.
- Respecter les licences/CGU des fournisseurs de tuiles (IGN/SCAN25, OSM,
  OpenTopoMap) : attribution affichée, pas de téléchargement abusif.

## Tests
- Tests unitaires sur tout `src/core/**` (parsing, geo, conversions, routing client
  mocké). Lancer les tests avant de déclarer une phase terminée.

## Commits
- Un commit par unité logique cohérente, message en français impératif :
  `type(scope): description` (types: feat, fix, refactor, test, docs, chore).
  Ex. `feat(routing): snap-to-path via BRouter offline`.
- Ne pas committer de clés/API, de données de tuiles, ni de fichiers `.rd5`.

## Documentation à maintenir
- `ARCHITECTURE.md` : arborescence, modèle de données, flux carte ↔ store ↔ GPX.
- `DECISIONS.md` : chaque décision technique non triviale (1-2 lignes, datée).
- `CLAUDE.md` : ces règles, mises à jour si une convention change.

## Format d'un plan de phase (à produire avant de coder)
- Objectif de la phase (1 phrase).
- Fichiers créés / modifiés.
- Types/structures introduits ou modifiés.
- Points de risque / dépendances externes.
- Critère de validation (comment je vérifie que c'est fini).
