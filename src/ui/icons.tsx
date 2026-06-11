import type { ReactElement } from "react";

/**
 * Jeu d'icônes SVG maison (trait 1.8, bouts arrondis) — l'identité visuelle de
 * l'app repose sur le motif « trace » : lignes continues, sommets marqués.
 * Toutes héritent de `currentColor` pour suivre le thème.
 */

interface IconProps {
  /** Taille en pixels (carré). */
  size?: number;
  className?: string;
}

function base(
  props: IconProps,
  children: ReactElement | ReactElement[],
): ReactElement {
  const { size = 16, className } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Logo : trace qui gravit un sommet, point de départ et d'arrivée. */
export function IconLogo(props: IconProps): ReactElement {
  return base(props, [
    <path key="t" d="M3 18 L8 11 L12 14 L17 6 L21 9" className="logo-trace" />,
    <circle key="s" cx="3" cy="18" r="1.6" fill="currentColor" stroke="none" />,
    <circle key="e" cx="21" cy="9" r="1.6" fill="currentColor" stroke="none" />,
  ]);
}

export function IconUndo(props: IconProps): ReactElement {
  return base(props, [
    <path key="a" d="M8 7 L4 11 L8 15" />,
    <path key="b" d="M4 11 H15 a5 5 0 0 1 0 10 H10" />,
  ]);
}

export function IconRedo(props: IconProps): ReactElement {
  return base(props, [
    <path key="a" d="M16 7 L20 11 L16 15" />,
    <path key="b" d="M20 11 H9 a5 5 0 0 0 0 10 H14" />,
  ]);
}

/** Crayon qui trace un chemin. */
export function IconDraw(props: IconProps): ReactElement {
  return base(props, [
    <path key="p" d="M14.5 5.5 L18.5 9.5 L8 20 H4 V16 Z" />,
    <path key="t" d="M3 12 C5 9 8 10 10 7" strokeDasharray="2.6 2.6" />,
  ]);
}

/** Édition de sommets : polyligne avec nœuds. */
export function IconEdit(props: IconProps): ReactElement {
  return base(props, [
    <path key="l" d="M5 18 L10 10 L15 13 L20 6" />,
    <rect key="a" x="3" y="16" width="4" height="4" rx="1" fill="currentColor" stroke="none" />,
    <rect key="b" x="8" y="8" width="4" height="4" rx="1" fill="currentColor" stroke="none" />,
    <rect key="c" x="18" y="4" width="4" height="4" rx="1" fill="currentColor" stroke="none" />,
  ]);
}

export function IconPin(props: IconProps): ReactElement {
  return base(props, [
    <path key="p" d="M12 21 C12 21 5.5 14.5 5.5 9.8 A6.5 6.5 0 0 1 18.5 9.8 C18.5 14.5 12 21 12 21 Z" />,
    <circle key="c" cx="12" cy="9.8" r="2.2" />,
  ]);
}

export function IconSearch(props: IconProps): ReactElement {
  return base(props, [
    <circle key="c" cx="10.5" cy="10.5" r="6" />,
    <path key="h" d="M15 15 L20.5 20.5" />,
  ]);
}

export function IconClose(props: IconProps): ReactElement {
  return base(props, [
    <path key="a" d="M6 6 L18 18" />,
    <path key="b" d="M18 6 L6 18" />,
  ]);
}

export function IconTrash(props: IconProps): ReactElement {
  return base(props, [
    <path key="l" d="M4.5 7 H19.5" />,
    <path key="t" d="M9.5 7 V5 a1 1 0 0 1 1-1 h3 a1 1 0 0 1 1 1 V7" />,
    <path key="b" d="M6.5 7 L7.4 19 a1.5 1.5 0 0 0 1.5 1.4 h6.2 a1.5 1.5 0 0 0 1.5-1.4 L17.5 7" />,
  ]);
}

/** Cible / recadrer sur la carte. */
export function IconTarget(props: IconProps): ReactElement {
  return base(props, [
    <circle key="o" cx="12" cy="12" r="6.5" />,
    <circle key="i" cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />,
    <path key="n" d="M12 2.5 V5.5" />,
    <path key="s" d="M12 18.5 V21.5" />,
    <path key="w" d="M2.5 12 H5.5" />,
    <path key="e" d="M18.5 12 H21.5" />,
  ]);
}

/** Crayon simple (renommer). */
export function IconRename(props: IconProps): ReactElement {
  return base(props, [
    <path key="p" d="M14.5 5.5 L18.5 9.5 L8 20 H4 V16 Z" />,
  ]);
}

export function IconChevronLeft(props: IconProps): ReactElement {
  return base(props, [<path key="p" d="M14.5 6 L8.5 12 L14.5 18" />]);
}

export function IconChevronRight(props: IconProps): ReactElement {
  return base(props, [<path key="p" d="M9.5 6 L15.5 12 L9.5 18" />]);
}

export function IconChevronUp(props: IconProps): ReactElement {
  return base(props, [<path key="p" d="M6 14.5 L12 8.5 L18 14.5" />]);
}

export function IconChevronDown(props: IconProps): ReactElement {
  return base(props, [<path key="p" d="M6 9.5 L12 15.5 L18 9.5" />]);
}

export function IconArrowUp(props: IconProps): ReactElement {
  return base(props, [
    <path key="l" d="M12 19 V5" />,
    <path key="h" d="M6 11 L12 5 L18 11" />,
  ]);
}

export function IconArrowDown(props: IconProps): ReactElement {
  return base(props, [
    <path key="l" d="M12 5 V19" />,
    <path key="h" d="M6 13 L12 19 L18 13" />,
  ]);
}
