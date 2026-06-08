// Backend Tauri — volontairement minimal.
// Limité aux capacités natives (à venir : sidecars BRouter, serveur de tuiles
// MBTiles, accès FS). Pas de logique métier dupliquée ici : elle vit côté
// frontend dans `src/core/` et `src/store/`.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
