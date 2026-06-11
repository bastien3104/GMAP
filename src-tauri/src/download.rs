//! Téléchargement d'une zone (emprise + plage de zooms) dans le MBTiles d'un fond.
//! Séquentiel (naturellement throttlé), avec plafond anti-abus et progression émise.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::{mbtiles, providers, AppState};

/// Plafond de tuiles par téléchargement (anti-abus / respect des CGU).
const MAX_TILES: usize = 50_000;

/// Emprise reçue du frontend.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BboxArg {
    min_lon: f64,
    min_lat: f64,
    max_lon: f64,
    max_lat: f64,
}

/// Évènement de progression émis pendant le téléchargement.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    layer: String,
    done: usize,
    total: usize,
    fetched: usize,
}

/// Résultat final du téléchargement.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    total: usize,
    fetched: usize,
}

fn clamp_u32(value: f64, max: u32) -> u32 {
    if value < 0.0 {
        0
    } else if value as u32 > max {
        max
    } else {
        value as u32
    }
}

/// Convertit lon/lat en indices de tuile XYZ (mirror de `tile-math.ts`).
fn lonlat_to_tile(z: u32, lon: f64, lat: f64) -> (u32, u32) {
    let n = (1u32 << z) as f64;
    let x = ((lon + 180.0) / 360.0 * n).floor();
    let lat_rad = lat.to_radians();
    let y = ((1.0 - lat_rad.tan().asinh() / std::f64::consts::PI) / 2.0 * n).floor();
    let max = (1u32 << z) - 1;
    (clamp_u32(x, max), clamp_u32(y, max))
}

/// Énumère les tuiles (z, x, y) couvrant l'emprise sur la plage de zooms.
fn enumerate(bbox: &BboxArg, min_zoom: u32, max_zoom: u32) -> Vec<(u32, u32, u32)> {
    let mut tiles = Vec::new();
    for z in min_zoom..=max_zoom {
        let (x0, y0) = lonlat_to_tile(z, bbox.min_lon, bbox.max_lat); // haut-gauche
        let (x1, y1) = lonlat_to_tile(z, bbox.max_lon, bbox.min_lat); // bas-droit
        let (min_x, max_x) = (x0.min(x1), x0.max(x1));
        let (min_y, max_y) = (y0.min(y1), y0.max(y1));
        for x in min_x..=max_x {
            for y in min_y..=max_y {
                tiles.push((z, x, y));
            }
        }
    }
    tiles
}

/// Télécharge une zone dans le MBTiles du fond `layer`.
#[tauri::command]
pub async fn download_zone(
    app: AppHandle,
    layer: String,
    min_zoom: u32,
    max_zoom: u32,
    bbox: BboxArg,
) -> Result<DownloadResult, String> {
    if providers::provider(&layer).is_none() {
        return Err(format!("Fond inconnu : {layer}"));
    }
    if min_zoom > max_zoom {
        return Err("Plage de zooms invalide.".into());
    }
    let tiles = enumerate(&bbox, min_zoom, max_zoom);
    if tiles.is_empty() {
        return Err("Aucune tuile dans la zone.".into());
    }
    if tiles.len() > MAX_TILES {
        return Err(format!(
            "Zone trop vaste : {} tuiles (max {MAX_TILES}). Réduis la zone ou la plage de zooms.",
            tiles.len()
        ));
    }

    let handle = tauri::async_runtime::spawn_blocking(move || download_blocking(app, layer, tiles));
    handle.await.map_err(|e| e.to_string())?
}

/// Supprime du cache les tuiles d'une zone (emprise + plage de zooms) pour libérer
/// l'espace. Des tuiles partagées avec une autre zone peuvent partir (re-téléchargées
/// en ligne au besoin). Renvoie le nombre de tuiles supprimées.
#[tauri::command]
pub async fn delete_zone_tiles(
    app: AppHandle,
    layer: String,
    min_zoom: u32,
    max_zoom: u32,
    bbox: BboxArg,
) -> Result<usize, String> {
    if min_zoom > max_zoom {
        return Err("Plage de zooms invalide.".into());
    }
    let tiles = enumerate(&bbox, min_zoom, max_zoom);
    let handle = tauri::async_runtime::spawn_blocking(move || -> Result<usize, String> {
        let db_path = mbtiles::mbtiles_path(&app, &layer)?;
        let conn = mbtiles::open_init(&db_path).map_err(|e| e.to_string())?;
        let _ = conn.execute_batch("BEGIN");
        let mut deleted = 0usize;
        for &(z, x, y) in &tiles {
            deleted += mbtiles::delete_tile(&conn, z, x, y).map_err(|e| e.to_string())?;
        }
        let _ = conn.execute_batch("COMMIT");
        Ok(deleted)
    });
    handle.await.map_err(|e| e.to_string())?
}

fn download_blocking(
    app: AppHandle,
    layer: String,
    tiles: Vec<(u32, u32, u32)>,
) -> Result<DownloadResult, String> {
    let db_path = mbtiles::mbtiles_path(&app, &layer)?;
    let conn = mbtiles::open_init(&db_path).map_err(|e| e.to_string())?;
    let http = app.state::<AppState>().http.clone();

    let total = tiles.len();
    let mut fetched = 0usize;

    for (index, &(z, x, y)) in tiles.iter().enumerate() {
        if !mbtiles::tile_exists(&conn, z, x, y) {
            if let Some(url) = providers::tile_url(&layer, z, x, y) {
                if let Ok(resp) = http.get(&url).send() {
                    if resp.status().is_success() {
                        if let Ok(bytes) = resp.bytes() {
                            let _ = mbtiles::put_tile(&conn, z, x, y, &bytes);
                            fetched += 1;
                        }
                    }
                }
            }
        }
        let done = index + 1;
        if done % 16 == 0 || done == total {
            let _ = app.emit(
                "download-progress",
                DownloadProgress {
                    layer: layer.clone(),
                    done,
                    total,
                    fetched,
                },
            );
        }
    }

    Ok(DownloadResult { total, fetched })
}
