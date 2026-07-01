import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { BRAND_NAME, SCHOOL_NAME } from "../config/brand";
import { getCurrentSchool } from "../services/schoolService";
import defaultLogo from "../assets/branding/logo-placeholder.svg";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");

const SUPER_ADMIN_NAV = [
  { to: "/super-admin/dashboard", label: "Vue globale", short: "VG" },
  { to: "/super-admin/schools", label: "Ecoles", short: "EC" },
  { to: "/admin", label: "Utilisateurs", short: "UT" },
];

const SCHOOL_NAV = [
  { to: "/dashboard", label: "Tableau de bord", short: "TD" },
  { to: "/students", label: "Eleves", short: "EL" },
  { to: "/classes", label: "Classes", short: "CL" },
  { to: "/payments", label: "Paiements", short: "PA" },
  { to: "/monthly-fees", label: "Mensualites", short: "ME" },
  { to: "/unpaid", label: "Impayes", short: "IM" },
];

const readSidebarCollapsed = () => {
  try {
    return localStorage.getItem("sidebar_collapsed") === "true";
  } catch {
    return false;
  }
};

const resolveLogoUrl = (logoPath) => {
  if (!logoPath) {
    return defaultLogo;
  }

  if (/^https?:\/\//i.test(logoPath)) {
    return logoPath;
  }

  const normalized = String(logoPath).replace(/\\/g, "/").replace(/^\/+/, "");
  return `${API_URL}/${normalized}`;
};

const toTitleCase = (value) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const resolveUserDisplayName = (user) => {
  const firstName = String(user?.first_name || "").trim();
  const lastName = String(user?.last_name || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) {
    return toTitleCase(fullName);
  }

  const emailLocalPart = String(user?.email || "").split("@")[0] || "";
  const fromEmail = emailLocalPart.replace(/[._-]+/g, " ").trim();
  return fromEmail ? toTitleCase(fromEmail) : "Utilisateur";
};

const resolveRoleLabel = (role) => {
  const mapping = {
    super_admin: "Super admin",
    admin: "Admin",
    user: "Utilisateur",
  };

  return mapping[role] || "Utilisateur";
};

function NavItem({ to, label, short, collapsed }) {
  return (
    <li>
      <NavLink to={to} title={collapsed ? label : undefined}>
        <span className="nav-short">{short}</span>
        <span className="nav-label">{label}</span>
      </NavLink>
    </li>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === "super_admin";
  const [school, setSchool] = useState({ id: null, name: null, logo_path: null });
  const [logoSrc, setLogoSrc] = useState(defaultLogo);
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);

  useEffect(() => {
    if (isSuperAdmin) {
      setSchool({ id: null, name: null, logo_path: null });
      setLogoSrc(defaultLogo);
      return;
    }

    getCurrentSchool().then(setSchool).catch(() => null);
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      setLogoSrc(defaultLogo);
      return;
    }

    setLogoSrc(resolveLogoUrl(school?.logo_path));
  }, [isSuperAdmin, school?.logo_path]);

  useEffect(() => {
    try {
      localStorage.setItem("sidebar_collapsed", collapsed ? "true" : "false");
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  const schoolName = useMemo(() => school?.name || SCHOOL_NAME, [school?.name]);
  const sidebarTitle = isSuperAdmin ? BRAND_NAME : schoolName;
  const sidebarKicker = isSuperAdmin ? "Espace global" : BRAND_NAME;
  const userDisplayName = useMemo(() => resolveUserDisplayName(user), [user]);

  const navItems = useMemo(() => {
    if (isSuperAdmin) {
      return SUPER_ADMIN_NAV;
    }

    const items = [...SCHOOL_NAV];
    if (user?.role === "admin") {
      items.push({ to: "/admin", label: "Equipe", short: "EQ" });
    }
    return items;
  }, [user?.role]);

  const onLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Developper le menu" : "Reduire le menu"}
            title={collapsed ? "Developper" : "Reduire"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <div className="sidebar-body">
          <div className="sidebar-head">
            <img
              className="brand-logo"
              src={logoSrc}
              alt={isSuperAdmin ? `${BRAND_NAME} logo` : `${sidebarTitle} logo`}
              onError={() => setLogoSrc(defaultLogo)}
            />
            <div className="sidebar-head-text">
              <p className="brand-kicker">{sidebarKicker}</p>
              <h3 className="brand-title">{sidebarTitle}</h3>
              <p className="muted">Connecte: {userDisplayName}</p>
            </div>
          </div>

          <nav>
            <ul className="nav-list">
              {navItems.map((item) => (
                <NavItem key={item.to} {...item} collapsed={collapsed} />
              ))}
            </ul>
          </nav>
        </div>

        <button
          className="ghost-btn"
          onClick={onLogout}
          title={collapsed ? "Deconnexion" : undefined}
        >
          <span className="nav-short">DC</span>
          <span className="nav-label">Deconnexion</span>
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="brand-kicker">Pilotage financier</p>
            <h2 className="topbar-title">{BRAND_NAME} Centre de pilotage</h2>
          </div>
          <div className="role-pill">{resolveRoleLabel(user?.role)}</div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
