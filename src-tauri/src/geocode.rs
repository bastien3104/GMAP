//! Géocodage online via le service de la Géoplateforme.
//! Appel HTTP côté Rust (réutilise `reqwest`) pour éviter le CORS ; parsing côté frontend.

use tauri::{AppHandle, Manager};

use crate::AppState;

const ENDPOINT: &str = "https://data.geopf.fr/geocodage/search";

/// Recherche d'adresses/lieux pour une requête texte ; renvoie le JSON brut (GeoJSON).
#[tauri::command]
pub async fn geocode_online(app: AppHandle, query: String) -> Result<String, String> {
    let q = query.trim().to_string();
    if q.is_empty() {
        return Err("Requête vide.".to_string());
    }

    let http = app.state::<AppState>().http.clone();
    let handle = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let resp = http
            .get(ENDPOINT)
            .query(&[
                ("q", q.as_str()),
                ("limit", "8"),
                ("index", "address,poi"),
            ])
            .send()
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("Service de géocodage : HTTP {}", resp.status()));
        }
        resp.text().map_err(|e| e.to_string())
    });
    handle.await.map_err(|e| e.to_string())?
}
