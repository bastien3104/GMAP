import { useEffect } from "react";
import { useUiStore } from "../store/ui-store";

/**
 * Applique le thème courant sur `<html data-theme>`.
 *
 * Le mode « auto » est **résolu ici** vers `light`/`dark` selon l'OS (et suit ses
 * changements en direct) ; l'attribut reflète donc toujours le thème *effectif*, ce
 * qui permet au CSS de ne cibler que `[data-theme="dark"]`.
 */
export function useTheme(): void {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = (): void => {
      const effective = theme === "auto" ? (media.matches ? "dark" : "light") : theme;
      root.dataset.theme = effective;
    };
    apply();

    if (theme === "auto") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    return undefined;
  }, [theme]);
}
