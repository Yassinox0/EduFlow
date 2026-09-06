import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSuperAdminDashboard } from "../services/schoolService";
import useI18n from "../hooks/useI18n";

const formatMoney = (value, language) =>
  new Intl.NumberFormat(language === "ar" ? "ar-MA" : "fr-MA", { style: "currency", currency: "MAD" }).format(
    Number(value || 0)
  );

export default function SuperAdminDashboardPage() {
  const { language, t } = useI18n();
  const [stats, setStats] = useState({
    schools_total: 0,
    schools_active: 0,
    users_total: 0,
    users_active: 0,
    total_collected: 0,
    outstanding_balance: 0,
  });

  useEffect(() => {
    getSuperAdminDashboard()
      .then(setStats)
      .catch(() => null);
  }, []);

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">{t("superAdmin.vision")}</p>
        <h1>{t("superAdmin.title")}</h1>
        <p className="muted">{t("superAdmin.description")}</p>
      </section>

      <section className="kpi-grid">
        <article className="panel kpi"><p className="kpi-label">{t("superAdmin.schools")}</p><h2>{stats.schools_total}</h2></article>
        <article className="panel kpi"><p className="kpi-label">{t("superAdmin.activeSchools")}</p><h2>{stats.schools_active}</h2></article>
        <article className="panel kpi"><p className="kpi-label">{t("superAdmin.users")}</p><h2>{stats.users_total}</h2></article>
      </section>

      <section className="panel split-panel">
        <div>
          <h3>{t("superAdmin.centralOperations")}</h3>
          <p className="muted">{t("superAdmin.centralOperationsHelp")}</p>
          <div className="chips">
            <Link to="/super-admin/schools"><span>{t("superAdmin.manageSchools")}</span></Link>
            <span>{t("superAdmin.collected", { amount: formatMoney(stats.total_collected, language) })}</span>
            <span>{t("superAdmin.outstanding", { amount: formatMoney(stats.outstanding_balance, language) })}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
