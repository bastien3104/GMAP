// Backend Tauri — volontairement minimal.
// Limité aux capacités natives (à venir : sidecars BRouter, serveur de tuiles
// MBTiles). Pas de logique métier dupliquée ici : elle vit côté frontend dans
// `src/core/` et `src/store/`.

use std::fs;

/// Écrit un contenu texte dans un fichier (accès FS natif).
/// Utilisé par l'export GPX après choix du chemin via la boîte de dialogue native.
#[tauri::command]
fn save_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_text_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
