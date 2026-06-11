//! Accès au cache de tuiles offline au format MBTiles (SQLite).
//! Schéma MBTiles standard ; l'axe `y` est stocké en convention TMS (inversé).

use std::path::{Path, PathBuf};
use std::time::Duration;

use rusqlite::{params, Connection, OptionalExtension};
use tauri::{AppHandle, Manager, Runtime};

/// Convertit un `y` XYZ en `tile_row` MBTiles (TMS).
fn tms_row(z: u32, y: u32) -> u32 {
    (1u32 << z) - 1 - y
}

/// Chemin du fichier MBTiles d'un fond (crée le dossier `tiles/` si besoin).
pub fn mbtiles_path<R: Runtime>(app: &AppHandle<R>, layer: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("dossier de données indisponible : {e}"))?
        .join("tiles");
    std::fs::create_dir_all(&dir).map_err(|e| format!("création du dossier tuiles : {e}"))?;
    Ok(dir.join(format!("{layer}.mbtiles")))
}

/// Ouvre (ou crée+initialise) un MBTiles. WAL + busy_timeout pour la concurrence
/// lecture/écriture (le téléchargement écrit pendant que la carte lit).
pub fn open_init(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.busy_timeout(Duration::from_secs(5))?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS metadata (name TEXT, value TEXT);
         CREATE TABLE IF NOT EXISTS tiles (
            zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB);
         CREATE UNIQUE INDEX IF NOT EXISTS tile_index
            ON tiles (zoom_level, tile_column, tile_row);",
    )?;
    Ok(conn)
}

/// Lit une tuile (octets) si présente dans le cache.
pub fn get_tile(conn: &Connection, z: u32, x: u32, y: u32) -> Option<Vec<u8>> {
    conn.query_row(
        "SELECT tile_data FROM tiles WHERE zoom_level = ?1 AND tile_column = ?2 AND tile_row = ?3",
        params![z, x, tms_row(z, y)],
        |row| row.get::<_, Vec<u8>>(0),
    )
    .optional()
    .ok()
    .flatten()
}

/// Indique si une tuile est déjà en cache.
pub fn tile_exists(conn: &Connection, z: u32, x: u32, y: u32) -> bool {
    conn.query_row(
        "SELECT 1 FROM tiles WHERE zoom_level = ?1 AND tile_column = ?2 AND tile_row = ?3",
        params![z, x, tms_row(z, y)],
        |_| Ok(()),
    )
    .optional()
    .ok()
    .flatten()
    .is_some()
}

/// Écrit une tuile dans le cache (remplace si déjà présente).
pub fn put_tile(conn: &Connection, z: u32, x: u32, y: u32, data: &[u8]) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data)
         VALUES (?1, ?2, ?3, ?4)",
        params![z, x, tms_row(z, y), data],
    )?;
    Ok(())
}

/// Nombre de tuiles en cache pour ce fond.
pub fn count_tiles(conn: &Connection) -> i64 {
    conn.query_row("SELECT COUNT(*) FROM tiles", [], |row| row.get(0))
        .unwrap_or(0)
}

/// Taille totale (octets) des tuiles en cache pour ce fond.
pub fn total_bytes(conn: &Connection) -> i64 {
    conn.query_row("SELECT COALESCE(SUM(LENGTH(tile_data)), 0) FROM tiles", [], |row| {
        row.get(0)
    })
    .unwrap_or(0)
}

/// Supprime une tuile du cache. Renvoie le nombre de lignes supprimées (0 ou 1).
pub fn delete_tile(conn: &Connection, z: u32, x: u32, y: u32) -> rusqlite::Result<usize> {
    conn.execute(
        "DELETE FROM tiles WHERE zoom_level = ?1 AND tile_column = ?2 AND tile_row = ?3",
        params![z, x, tms_row(z, y)],
    )
}
