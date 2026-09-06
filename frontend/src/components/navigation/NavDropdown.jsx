import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";

export default function NavDropdown({ label, items }) {
  const detailsRef = useRef(null);
  const location = useLocation();
  const hasActiveItem = items.some(({ to, end, activePrefix }) => (
    (activePrefix && location.pathname.startsWith(activePrefix))
    || (end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`))
  ));

  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }, [location.pathname]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target)) {
        detailsRef.current.open = false;
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  return (
    <li className="nav-group">
      <details ref={detailsRef} name="primary-navigation" className={`nav-dropdown ${hasActiveItem ? "active" : ""}`}>
        <summary>
          <span>{label}</span>
          <span className="nav-dropdown-caret" aria-hidden="true">▾</span>
        </summary>
        <div className="nav-dropdown-menu">
          {items.map(({ to, label: itemLabel, end = false }) => (
            <NavLink key={to} to={to} end={end}>
              {itemLabel}
            </NavLink>
          ))}
        </div>
      </details>
    </li>
  );
}
