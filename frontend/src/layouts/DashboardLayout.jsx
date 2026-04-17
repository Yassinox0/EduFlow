import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { BRAND_NAME, SCHOOL_NAME } from "../config/brand";
import { getCurrentSchool } from "../services/schoolService";
import defaultLogo from "../assets/branding/logo-placeholder.svg";

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [school, setSchool] = useState({ id: null, name: null, logo_path: null });

  useEffect(() => {
    getCurrentSchool().then(setSchool).catch(() => null);
  }, []);

  const schoolName = useMemo(() => school?.name || SCHOOL_NAME, [school?.name]);

  const logoSrc = useMemo(() => {
    if (!school?.logo_path) {
      return defaultLogo;
    }

    if (school.logo_path.startsWith("http")) {
      return school.logo_path;
    }

    return `http://127.0.0.1:8080/${school.logo_path.replace(/^\/+/, "")}`;
  }, [school?.logo_path]);

  const onLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <img className="brand-logo" src={logoSrc} alt={`${schoolName} logo`} />
          <div>
            <p className="brand-kicker">{BRAND_NAME}</p>
            <h3 className="brand-title">{schoolName}</h3>
            <p className="muted">Connected: {user?.email}</p>
          </div>
        </div>

        <nav>
          <ul className="nav-list">
            {user?.role === "super_admin" ? (
              <>
                <li><NavLink to="/super-admin/dashboard">Global Dashboard</NavLink></li>
                <li><NavLink to="/super-admin/schools">Schools</NavLink></li>
                <li><NavLink to="/admin">Users Management</NavLink></li>
              </>
            ) : (
              <>
                <li><NavLink to="/dashboard">Dashboard</NavLink></li>
                <li><NavLink to="/students">Students</NavLink></li>
                <li><NavLink to="/payments">Payments</NavLink></li>
                <li><NavLink to="/monthly-fees">Monthly Fees</NavLink></li>
                <li><NavLink to="/unpaid">Unpaid</NavLink></li>
                {(user?.role === "admin") && (
                  <li><NavLink to="/admin">Administration</NavLink></li>
                )}
              </>
            )}
          </ul>
        </nav>

        <button className="ghost-btn" onClick={onLogout}>Sign out</button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="brand-kicker">Financial Management Platform</p>
            <h2 className="topbar-title">{BRAND_NAME} Control Center</h2>
          </div>
          <div className="role-pill">{user?.role || "accountant"}</div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
