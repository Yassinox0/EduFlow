import { useCallback, useEffect, useMemo, useState } from "react";
import { getUnpaidMonthlyFees } from "../services/monthlyFeeService";
import { getPaymentMethods } from "../services/paymentMethodService";
import { createPayment } from "../services/paymentService";
import { downloadReceiptPdf } from "../services/receiptService";

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

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function UnpaidPage() {
  const [items, setItems] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [settlingItem, setSettlingItem] = useState(null);
  const [settleForm, setSettleForm] = useState({
    amount_paid: "",
    payment_date: todayIso(),
    payment_method_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadItems = useCallback(async () => {
    const data = await getUnpaidMonthlyFees();
    setItems(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    Promise.all([loadItems(), getPaymentMethods()])
      .then(([, methods]) => {
        const safeMethods = Array.isArray(methods) ? methods : [];
        setPaymentMethods(safeMethods);
        if (safeMethods.length) {
          setSettleForm((prev) => ({
            ...prev,
            payment_method_id: String(safeMethods[0].id),
          }));
        }
      })
      .catch(() => setError("Impossible de charger les impayes."));
  }, [loadItems]);

  const totalRemaining = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.remaining_amount || 0), 0),
    [items]
  );

  const openSettle = (item) => {
    setError("");
    setMessage("");
    setSettlingItem(item);
    setSettleForm({
      amount_paid: String(item.remaining_amount ?? ""),
      payment_date: todayIso(),
      payment_method_id: paymentMethods[0]?.id ? String(paymentMethods[0].id) : "",
    });
  };

  const closeSettle = () => {
    setSettlingItem(null);
    setSettleForm({
      amount_paid: "",
      payment_date: todayIso(),
      payment_method_id: paymentMethods[0]?.id ? String(paymentMethods[0].id) : "",
    });
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    if (!settlingItem) {
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    const amountPaid = Number(settleForm.amount_paid);
    const remaining = Number(settlingItem.remaining_amount || 0);

    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      setError("Le montant doit etre superieur a 0.");
      setLoading(false);
      return;
    }

    if (amountPaid > remaining) {
      setError(`Le montant ne peut pas depasser le reste a payer (${formatMoney(remaining)}).`);
      setLoading(false);
      return;
    }

    try {
      const result = await createPayment({
        student_id: settlingItem.student_id,
        monthly_fee_id: settlingItem.id,
        amount_paid: amountPaid,
        payment_date: settleForm.payment_date,
        payment_method_id: Number(settleForm.payment_method_id),
      });

      const isFullyPaid = result.monthly_fee_status === "PAID";
      setMessage(
        isFullyPaid
          ? `Situation regularisee. Paiement #${result.id} enregistre. Mensualite soldee. Recu PDF telecharge.`
          : `Paiement #${result.id} enregistre. Reste: ${formatMoney(result.monthly_fee_remaining_amount)}. Recu PDF telecharge.`
      );
      try {
        await downloadReceiptPdf(result.id);
      } catch {
        setMessage(`Paiement #${result.id} enregistre, mais le recu PDF n'a pas pu etre genere.`);
      }
      closeSettle();
      await loadItems();
    } catch (err) {
      setError(err?.response?.data?.message || "Echec de regularisation du paiement.");
    } finally {
      setLoading(false);
    }
  };

  const settleButtonLabel = (item) =>
    item.status === "PARTIAL" ? "Regler le solde" : "Encaisser";

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <h2>Impayes</h2>
        <p className="muted">
          Suivi des soldes restants. Utilisez « Regler le solde » pour encaisser le reste et mettre a jour la situation.
        </p>
      </section>

      <section className="kpi-grid one-col">
        <article className="panel kpi">
          <p className="kpi-label">Total a recouvrer</p>
          <h2>{formatMoney(totalRemaining)}</h2>
          <p className="muted">Montant cumule de toutes les mensualites non reglees</p>
        </article>
      </section>

      {settlingItem && (
        <section className="panel">
          <h3>
            Regulariser — {settlingItem.first_name} {settlingItem.last_name} ({settlingItem.month_label}/{settlingItem.year_value})
          </h3>
          <p className="muted">
            Total: {formatMoney(settlingItem.total_amount)} · Deja paye: {formatMoney(settlingItem.amount_paid)} · Reste:{" "}
            {formatMoney(settlingItem.remaining_amount)}
          </p>
          <form className="form-grid" onSubmit={handleSettle}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={settlingItem.remaining_amount}
              placeholder="Montant a encaisser"
              value={settleForm.amount_paid}
              onChange={(e) => setSettleForm({ ...settleForm, amount_paid: e.target.value })}
              required
            />
            <input
              type="date"
              value={settleForm.payment_date}
              onChange={(e) => setSettleForm({ ...settleForm, payment_date: e.target.value })}
              required
            />
            <select
              value={settleForm.payment_method_id}
              onChange={(e) => setSettleForm({ ...settleForm, payment_method_id: e.target.value })}
              required
            >
              <option value="">Mode de paiement</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.label}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "12px", gridColumn: "1 / -1" }}>
              <button type="submit" disabled={loading}>
                {loading ? "Enregistrement..." : "Confirmer et enregistrer dans Paiements"}
              </button>
              <button type="button" className="secondary-btn" onClick={closeSettle} disabled={loading}>
                Annuler
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        {message && <p className="muted">{message}</p>}
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
                <th>Total</th>
                <th>Paye</th>
                <th>Reste</th>
                <th>Echeance</th>
                <th>Statut</th>
                <th>Jours de retard</th>
                <th>Actions</th>
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
                  <td>{formatMoney(item.total_amount)}</td>
                  <td>{formatMoney(item.amount_paid)}</td>
                  <td>{formatMoney(item.remaining_amount)}</td>
                  <td>{item.due_date || "-"}</td>
                  <td>{statusLabel(item.status)}</td>
                  <td>{item.days_late ?? "-"}</td>
                  <td>
                    <button type="button" onClick={() => openSettle(item)}>
                      {settleButtonLabel(item)}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="12" className="table-empty">
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
