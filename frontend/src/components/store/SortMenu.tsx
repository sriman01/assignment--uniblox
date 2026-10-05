import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Icon } from "../ui/Icon";
import { useDismiss } from "./useDismiss";

export type SortOption<T extends string> = { value: T; label: string; href: string };

type SortMenuProps<T extends string> = {
  value: T;
  options: SortOption<T>[];
};

export function SortMenu<T extends string>({ value, options }: SortMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const location = useLocation();
  const close = useCallback(() => setOpen(false), []);
  const current = options.find((option) => option.value === value) ?? options[0];
  useDismiss(root, open, close);

  useEffect(() => {
    setOpen(false);
  }, [location.search]);

  return (
    <div className="sort-menu" ref={root}>
      <span className="muted small">Sort by</span>
      <button
        type="button"
        className="sort-menu__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        {current.label}
        <Icon name="chevronDown" size={16} />
      </button>
      <div id={panelId} className="dropdown sort-menu__panel" data-open={open} aria-hidden={!open} inert={!open}>
        {options.map((option) => (
          <Link
            key={option.value}
            to={option.href}
            replace
            preventScrollReset
            className="sort-menu__option"
            aria-current={option.value === value ? "true" : undefined}
          >
            {option.label}
            {option.value === value ? <Icon name="check" size={16} /> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
