import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";

/** Ferme le menu courant (fourni aux items). */
const MenuCloseContext = createContext<() => void>(() => {});

interface MenuProps {
  label: string;
  children: ReactNode;
}

/** Menu déroulant (style barre d'outils) : bouton + popover, fermeture clic-dehors / Échap. */
export function Menu({ label, children }: MenuProps): ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className={open ? "menu-trigger open" : "menu-trigger"}
        onClick={() => setOpen((o) => !o)}
      >
        {label} <span className="menu-caret">▾</span>
      </button>
      {open && (
        <div className="menu-popover" role="menu">
          <MenuCloseContext.Provider value={() => setOpen(false)}>
            {children}
          </MenuCloseContext.Provider>
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Coche (✓) pour les bascules / radios ; `undefined` = item d'action simple. */
  checked?: boolean;
}

/** Élément de menu (action, bascule ou radio). Ferme le menu après sélection. */
export function MenuItem({
  label,
  onSelect,
  disabled = false,
  checked,
}: MenuItemProps): ReactElement {
  const close = useContext(MenuCloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      className="menu-item"
      disabled={disabled}
      onClick={() => {
        onSelect();
        close();
      }}
    >
      <span className="menu-check">{checked === true ? "✓" : ""}</span>
      {label}
    </button>
  );
}

/** Séparateur horizontal dans un menu. */
export function MenuSeparator(): ReactElement {
  return <div className="menu-separator" />;
}
