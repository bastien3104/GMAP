import React from "react";
import ReactDOM from "react-dom/client";
// Police identitaire embarquée (fonctionne hors-ligne, aucun appel réseau).
import "@fontsource-variable/archivo";
import App from "./app/App";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Élément racine #root introuvable dans index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
