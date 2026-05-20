import { useEffect, useMemo, useState } from "react";
import { getUnpaidMonthlyFees } from "../services/monthlyFeeService";

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(
    Number(value || 0)
  );

const statusLabel = (value) => {
  if (value === "PAID") return "Paye";
  if (value === "PARTIAL") return "Partiel";
  if (value === "UNPAID") return "Impaye";
  return value || "-";
};

export default function UnpaidPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getUnpaidMonthlyFees()
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setError("Impossible de charger les impayes."));
  }, []);

  const totalRemaining = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.remaining_amount || 0), 0),
    [items]
  );

  return (
    <div className="admin-grid">
      <section className="panel">
        <h2>Impayes</h2>
        <p className="muted">Suivi des soldes restants et du retard de paiement.</p>
      </section>

      <section className="kpi-grid one-col">
        <article className="panel kpi">
          <p className="kpi-label">Total a recouvrer</p>
          <h2>{formatMoney(totalRemaining)}</h2>
          <p className="muted">Montant cumule de toutes les mensualites non reglees</p>
        </article>
      </section>

      <section className="panel">
        {error && <p className="error-text">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Eleve</th>
                <th>Parent</th>
                <th>Telephone</th>
                <th>Mois</th>
                <th>Annee</th>
                <th>Reste</th>
                <th>Echeance</th>
                <th>Statut</th>
                <th>Jours de retard</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.first_name} {item.last_name}
                  </td>
                  <td>{item.parent_name}</td>
                  <td>{item.phone || "-"}</td>
                  <td>{item.month_label}</td>
                  <td>{item.year_value}</td>
                  <td>{formatMoney(item.remaining_amount)}</td>
                  <td>{item.due_date || "-"}</td>
                  <td>{statusLabel(item.status)}</td>
                  <td>{item.days_late ?? "-"}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="9" className="table-empty">
                    Aucun impaye trouve.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
