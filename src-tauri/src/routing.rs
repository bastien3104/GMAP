//! Routing online via le service d'itinéraire de la Géoplateforme.
//! Appel HTTP côté Rust (réutilise le client `reqwest` partagé) pour éviter les
//! soucis de CORS dans la webview. Le parsing JSON est fait côté frontend (testé).

use tauri::{AppHandle, Manager};

use crate::AppState;

const ENDPOINT: &str = "https://data.geopf.fr/navigation/itineraire";

/// Calcule un itinéraire entre deux points et renvoie le corps JSON brut.
/// `start`/`end` sont des paires `[lon, lat]`.
#[tauri::command]
pub async fn route_online(
    app: AppHandle,
    profile: String,
    start: (f64, f64),
    end: (f64, f64),
) -> Result<String, String> {
    let profile = match profile.as_str() {
        "pedestrian" | "car" => profile,
        _ => "pedestrian".to_string(),
    };
    let url = format!(
        "{ENDPOINT}?resource=bdtopo-osrm&profile={profile}&optimization=shortest\
         &start={},{}&end={},{}&geometryFormat=geojson",
        start.0, start.1, end.0, end.1
    );

    let http = app.state::<AppState>().http.clone();
    let handle = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let resp = http.get(&url).send().map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("Service d'itinéraire : HTTP {}", resp.status()));
        }
        resp.text().map_err(|e| e.to_string())
    });
    handle.await.map_err(|e| e.to_string())?
}
