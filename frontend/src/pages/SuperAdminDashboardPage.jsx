import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSuperAdminDashboard } from "../services/schoolService";

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState({
    schools_total: 0,
    schools_active: 0,
    users_total: 0,
    users_active: 0,
    total_collected: 0,
    outstanding_balance: 0,
  });

  useEffect(() => {
    getSuperAdminDashboard().then(setStats).catch(() => null);
  }, []);

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">Central Oversight</p>
        <h1>Organization Monitoring</h1>
        <p className="muted">Consolidated visibility across all schools.</p>
      </section>

      <section className="kpi-grid">
        <article className="panel kpi"><p className="kpi-label">Schools</p><h2>{stats.schools_total}</h2></article>
        <article className="panel kpi"><p className="kpi-label">Active schools</p><h2>{stats.schools_active}</h2></article>
        <article className="panel kpi"><p className="kpi-label">Users</p><h2>{stats.users_total}</h2></article>
      </section>

      <section className="panel split-panel">
        <div>
          <h3>Operations</h3>
          <p className="muted">Manage schools, branding, and access governance.</p>
          <div className="chips">
            <Link to="/super-admin/schools"><span>Schools</span></Link>
            <span>Collected: {Number(stats.total_collected || 0).toFixed(2)}</span>
            <span>Outstanding: {Number(stats.outstanding_balance || 0).toFixed(2)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
