// Backend Tauri — capacités natives (accès FS, cache de tuiles offline, protocole
// tiles://). Pas de logique métier dupliquée : elle vit côté frontend (src/core, src/store).

mod download;
mod elevation;
mod geocode;
mod mbtiles;
mod providers;
mod routing;
mod tiles_protocol;

use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::State;

/// État partagé de l'application (drapeau hors-ligne + client HTTP réutilisable).
pub struct AppState {
    pub offline: AtomicBool,
    pub http: reqwest::blocking::Client,
}

/// Écrit un contenu texte dans un fichier (export GPX après choix du chemin).
#[tauri::command]
fn save_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| e.to_string())
}

/// Écrit un contenu binaire dans un fichier (export FIT).
#[tauri::command]
fn save_binary_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| e.to_string())
}

/// Active/désactive le mode hors-ligne (le handler tiles:// ne tente plus le réseau).
#[tauri::command]
fn set_offline(state: State<AppState>, offline: bool) {
    state.offline.store(offline, Ordering::Relaxed);
}

/// Nombre de tuiles en cache pour un fond donné.
#[tauri::command]
fn cache_stats(app: tauri::AppHandle, layer: String) -> Result<i64, String> {
    let path = mbtiles::mbtiles_path(&app, &layer)?;
    let conn = mbtiles::open_init(&path).map_err(|e| e.to_string())?;
    Ok(mbtiles::count_tiles(&conn))
}

/// Taille totale (octets) du cache de tuiles d'un fond.
#[tauri::command]
fn cache_size(app: tauri::AppHandle, layer: String) -> Result<i64, String> {
    let path = mbtiles::mbtiles_path(&app, &layer)?;
    let conn = mbtiles::open_init(&path).map_err(|e| e.to_string())?;
    Ok(mbtiles::total_bytes(&conn))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http = reqwest::blocking::Client::builder()
        .user_agent("GMAP/0.1 (application desktop d'edition GPX)")
        .build()
        .expect("client HTTP indisponible");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            offline: AtomicBool::new(false),
            http,
        })
        .register_asynchronous_uri_scheme_protocol("tiles", |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                let response = tiles_protocol::serve(&app, request);
                responder.respond(response);
            });
        })
        .invoke_handler(tauri::generate_handler![
            save_text_file,
            save_binary_file,
            set_offline,
            cache_stats,
            cache_size,
            download::download_zone,
            download::delete_zone_tiles,
            routing::route_online,
            routing::route_brouter,
            elevation::elevation_online,
            geocode::geocode_online,
            geocode::geocode_reverse_online
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
