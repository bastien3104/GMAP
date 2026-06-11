import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

/**
 * Sauvegarde de fichiers d'export, partagée par le menu et le dialogue d'export.
 * Sous Tauri : dialogue natif « Enregistrer sous » + commande Rust (WebView2 ne gère
 * pas le téléchargement par blob). En navigateur : repli téléchargement par ancre.
 *
 * Renvoie le chemin choisi (ou le nom de fichier en navigateur), ou `null` si annulé.
 */

async function pickPath(filename: string, ext: string): Promise<string | null> {
  return save({
    defaultPath: filename,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
}

function browserDownload(blobPart: BlobPart, filename: string): void {
  const url = URL.createObjectURL(new Blob([blobPart]));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Sauvegarde un contenu texte (GPX/GeoJSON/KML/TCX). */
export async function saveTextExport(
  content: string,
  filename: string,
  ext: string,
): Promise<string | null> {
  if (isTauri()) {
    const path = await pickPath(filename, ext);
    if (path === null) return null;
    await invoke("save_text_file", { path, contents: content });
    return path;
  }
  browserDownload(content, filename);
  return filename;
}

/** Sauvegarde un contenu binaire (FIT). */
export async function saveBinaryExport(
  bytes: Uint8Array,
  filename: string,
  ext: string,
): Promise<string | null> {
  if (isTauri()) {
    const path = await pickPath(filename, ext);
    if (path === null) return null;
    await invoke("save_binary_file", { path, contents: Array.from(bytes) });
    return path;
  }
  browserDownload(bytes, filename);
  return filename;
}
