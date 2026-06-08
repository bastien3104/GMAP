//! Handler du protocole custom `tiles://{layer}/{z}/{x}/{y}`.
//! Stratégie : MBTiles d'abord (offline), sinon réseau si en ligne, sinon tuile vide.
//! Exécuté dans un contexte bloquant (voir `lib.rs`).

use std::borrow::Cow;
use std::sync::atomic::Ordering;

use tauri::http::{Request, Response};
use tauri::{AppHandle, Manager, Runtime};

use crate::{mbtiles, providers, AppState};

/// PNG transparent 1×1 servi pour une tuile absente (évite les erreurs de rendu).
const TRANSPARENT_PNG: &[u8] = &[
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6,
    0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 98, 0, 1, 0, 0, 5, 0, 1, 13,
    10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
];

fn build(content_type: &str, body: Cow<'static, [u8]>) -> Response<Cow<'static, [u8]>> {
    Response::builder()
        .status(200)
        .header("Content-Type", content_type)
        .header("Access-Control-Allow-Origin", "*")
        .header("Cache-Control", "no-cache")
        .body(body)
        .expect("réponse tiles:// invalide")
}

/// Sert une tuile pour la requête `tiles://…`. Renvoie toujours une réponse valide.
pub fn serve<R: Runtime>(
    app: &AppHandle<R>,
    request: Request<Vec<u8>>,
) -> Response<Cow<'static, [u8]>> {
    match try_serve(app, &request) {
        Some((content_type, bytes)) => build(content_type, Cow::Owned(bytes)),
        None => build("image/png", Cow::Borrowed(TRANSPARENT_PNG)),
    }
}

fn try_serve<R: Runtime>(
    app: &AppHandle<R>,
    request: &Request<Vec<u8>>,
) -> Option<(&'static str, Vec<u8>)> {
    // Chemin attendu : /{layer}/{z}/{x}/{y}
    let path = request.uri().path();
    let parts: Vec<&str> = path.trim_start_matches('/').split('/').collect();
    if parts.len() < 4 {
        return None;
    }
    let layer = parts[0];
    let z: u32 = parts[1].parse().ok()?;
    let x: u32 = parts[2].parse().ok()?;
    let y: u32 = parts[3].split('.').next()?.parse().ok()?;

    let provider = providers::provider(layer)?;

    // 1) MBTiles d'abord.
    if let Ok(db_path) = mbtiles::mbtiles_path(app, layer) {
        if let Ok(conn) = mbtiles::open_init(&db_path) {
            if let Some(bytes) = mbtiles::get_tile(&conn, z, x, y) {
                return Some((provider.content_type, bytes));
            }
        }
    }

    // 2) Mode hors-ligne : on ne tente pas le réseau.
    let state = app.state::<AppState>();
    if state.offline.load(Ordering::Relaxed) {
        return None;
    }

    // 3) Réseau (sans mise en cache : seuls les téléchargements explicites écrivent).
    let url = providers::tile_url(layer, z, x, y)?;
    let resp = state.http.get(&url).send().ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let bytes = resp.bytes().ok()?.to_vec();
    Some((provider.content_type, bytes))
}
