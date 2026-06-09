//! Altimétrie online via le service de la Géoplateforme.
//! Appel HTTP côté Rust (réutilise `reqwest`) pour éviter le CORS ; parsing côté frontend.

use tauri::{AppHandle, Manager};

use crate::AppState;

const ENDPOINT: &str = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json";

/// Récupère les altitudes d'un lot de points `[lon, lat]` ; renvoie le JSON brut.
#[tauri::command]
pub async fn elevation_online(
    app: AppHandle,
    points: Vec<(f64, f64)>,
) -> Result<String, String> {
    if points.is_empty() {
        return Err("Aucun point à élever.".to_string());
    }
    let lon_param = points
        .iter()
        .map(|p| p.0.to_string())
        .collect::<Vec<_>>()
        .join("|");
    let lat_param = points
        .iter()
        .map(|p| p.1.to_string())
        .collect::<Vec<_>>()
        .join("|");

    let http = app.state::<AppState>().http.clone();
    let handle = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let resp = http
            .get(ENDPOINT)
            .query(&[
                ("lon", lon_param.as_str()),
                ("lat", lat_param.as_str()),
                ("resource", "ign_rge_alti_wld"),
                ("delimiter", "|"),
                ("zonly", "false"),
            ])
            .send()
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("Service altimétrique : HTTP {}", resp.status()));
        }
        resp.text().map_err(|e| e.to_string())
    });
    handle.await.map_err(|e| e.to_string())?
}
