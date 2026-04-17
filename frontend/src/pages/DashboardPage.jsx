import { useEffect, useMemo, useState } from "react";
import { getDashboardStats } from "../services/dashboardService";
import { SCHOOL_NAME } from "../config/brand";

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(
    Number(value || 0)
  );

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total_collected: 0,
    total_unpaid: 0,
    late_students: 0,
  });

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => null);
  }, []);

  const cards = useMemo(
    () => [
      {
        label: "Collected Revenue",
        value: formatMoney(stats.total_collected),
        helper: "All validated payments",
      },
      {
        label: "Outstanding Balance",
        value: formatMoney(stats.total_unpaid),
        helper: "Unpaid + partial invoices",
      },
      {
        label: "Late Students",
        value: Number(stats.late_students || 0).toString(),
        helper: "Students with pending fees",
      },
    ],
    [stats]
  );

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">Executive View</p>
        <h1>{SCHOOL_NAME} Financial Control Center</h1>
        <p className="muted">
          Daily snapshot of cash flow, debt exposure, and collection pressure.
        </p>
      </section>

      <section className="kpi-grid">
        {cards.map((card) => (
          <article key={card.label} className="panel kpi">
            <p className="kpi-label">{card.label}</p>
            <h2>{card.value}</h2>
            <p className="muted">{card.helper}</p>
          </article>
        ))}
      </section>

      <section className="panel split-panel">
        <div>
          <h3>Collections pipeline</h3>
          <p className="muted">Use this area to track collection campaigns by class.</p>
          <div className="chips">
            <span>Grade coverage</span>
            <span>Payment method mix</span>
            <span>Daily reconciliation</span>
            <span>Receipt audit</span>
          </div>
        </div>
        <div className="trend-box" aria-hidden="true">
          <div className="trend-line" />
        </div>
      </section>
    </div>
  );
}
