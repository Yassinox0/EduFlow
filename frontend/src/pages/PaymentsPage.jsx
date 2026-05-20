import { useEffect, useMemo, useState } from "react";
import { getPaymentMethods } from "../services/paymentMethodService";
import { createPayment, getPayments } from "../services/paymentService";
import { getStudents } from "../services/studentService";

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(
    Number(value || 0)
  );

const currentDate = new Date();

const emptyForm = {
  student_id: "",
  month_label: String(currentDate.getMonth() + 1).padStart(2, "0"),
  year_value: String(currentDate.getFullYear()),
  amount_paid: "",
  payment_date: currentDate.toISOString().slice(0, 10),
  payment_method_id: "",
};

const statusLabel = (value) => {
  if (value === "PAID") return "Paye";
  if (value === "PARTIAL") return "Partiel";
  if (value === "UNPAID") return "Impaye";
  return value || "-";
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    const [paymentsData, studentsData, methodsData] = await Promise.all([
      getPayments(),
      getStudents(),
      getPaymentMethods(),
    ]);

    const safePayments = Array.isArray(paymentsData) ? paymentsData : [];
    const safeStudents = Array.isArray(studentsData) ? studentsData : [];
    const safeMethods = Array.isArray(methodsData) ? methodsData : [];

    setPayments(safePayments);
    setStudents(safeStudents);
    setPaymentMethods(safeMethods);

    if (!form.payment_method_id && safeMethods.length) {
      setForm((prev) => ({ ...prev, payment_method_id: String(safeMethods[0].id) }));
    }
  };

  useEffect(() => {
    loadData().catch(() => setError("Impossible de charger les paiements."));
  }, []);

  const totalPaid = useMemo(
    () => payments.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0),
    [payments]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const payload = {
        student_id: Number(form.student_id),
        month_label: form.month_label,
        year_value: Number(form.year_value),
        amount_paid: Number(form.amount_paid),
        payment_date: form.payment_date,
        payment_method_id: Number(form.payment_method_id),
      };

      const result = await createPayment(payload);
      setMessage(
        `Paiement enregistre. Statut mensualite: ${statusLabel(result.monthly_fee_status)}, reste: ${formatMoney(
          result.monthly_fee_remaining_amount
        )}`
      );
      setForm((prev) => ({
        ...emptyForm,
        payment_method_id: prev.payment_method_id,
      }));
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Echec d'enregistrement du paiement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-grid">
      <section className="panel">
        <h2>Paiements</h2>
        <p className="muted">Saisie et tracabilite des encaissements mensuels.</p>
      </section>

      <section className="kpi-grid two-col">
        <article className="panel kpi">
          <p className="kpi-label">Operations enregistrees</p>
          <h2>{payments.length}</h2>
          <p className="muted">Nombre total de paiements saisis</p>
        </article>
        <article className="panel kpi">
          <p className="kpi-label">Total encaisse</p>
          <h2>{formatMoney(totalPaid)}</h2>
          <p className="muted">Somme des transactions en base</p>
        </article>
      </section>

      <section className="panel">
        <h3>Enregistrer un paiement</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <select
            value={form.student_id}
            onChange={(e) => setForm({ ...form, student_id: e.target.value })}
            required
          >
            <option value="">Selectionner un eleve</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.first_name} {student.last_name}
              </option>
            ))}
          </select>
          <input
            placeholder="Mois (01-12)"
            value={form.month_label}
            onChange={(e) => setForm({ ...form, month_label: e.target.value })}
            required
          />
          <input
            type="number"
            min="2000"
            max="2100"
            placeholder="Annee"
            value={form.year_value}
            onChange={(e) => setForm({ ...form, year_value: e.target.value })}
            required
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Montant paye"
            value={form.amount_paid}
            onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
            required
          />
          <input
            type="date"
            value={form.payment_date}
            onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
            required
          />
          <select
            value={form.payment_method_id}
            onChange={(e) => setForm({ ...form, payment_method_id: e.target.value })}
            required
          >
            <option value="">Mode de paiement</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={loading}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>
        {message && <p className="muted">{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Eleve</th>
                <th>Mois</th>
                <th>Annee</th>
                <th>Montant</th>
                <th>Date</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.id}</td>
                  <td>
                    {payment.first_name} {payment.last_name}
                  </td>
                  <td>{payment.month_label}</td>
                  <td>{payment.year_value}</td>
                  <td>{formatMoney(payment.amount_paid)}</td>
                  <td>{payment.payment_date}</td>
                  <td>{payment.payment_method_label || payment.payment_method}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan="7" className="table-empty">
                    Aucun paiement trouve.
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
