//! Configuration des fournisseurs de tuiles (miroir minimal de `src/map/basemaps.ts`).
//! Sert au handler `tiles://` et au téléchargement pour récupérer une tuile en ligne.
//! Ce n'est pas de la logique métier : juste la table des URLs/formats fournisseurs.

/// Fournisseur d'un fond : gabarit d'URL en ligne ({z}/{x}/{y}) et type MIME.
pub struct Provider {
    pub url_template: &'static str,
    pub content_type: &'static str,
}

const PLAN_IGN_URL: &str = "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png";
const ORTHO_IGN_URL: &str = "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg";
const OPENTOPOMAP_URL: &str = "https://a.tile.opentopomap.org/{z}/{x}/{y}.png";
const OSM_URL: &str = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/// Retourne le fournisseur d'un fond par son identifiant logique, ou `None`.
pub fn provider(layer: &str) -> Option<Provider> {
    match layer {
        "plan-ign-v2" => Some(Provider {
            url_template: PLAN_IGN_URL,
            content_type: "image/png",
        }),
        "ortho-ign" => Some(Provider {
            url_template: ORTHO_IGN_URL,
            content_type: "image/jpeg",
        }),
        "opentopomap" => Some(Provider {
            url_template: OPENTOPOMAP_URL,
            content_type: "image/png",
        }),
        "osm" => Some(Provider {
            url_template: OSM_URL,
            content_type: "image/png",
        }),
        _ => None,
    }
}

/// Construit l'URL d'une tuile en ligne pour un fond donné.
pub fn tile_url(layer: &str, z: u32, x: u32, y: u32) -> Option<String> {
    let p = provider(layer)?;
    Some(
        p.url_template
            .replace("{z}", &z.to_string())
            .replace("{x}", &x.to_string())
            .replace("{y}", &y.to_string()),
    )
}
