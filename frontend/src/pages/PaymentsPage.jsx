import { useEffect, useMemo, useState } from "react";
import { getPayments } from "../services/paymentService";

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(
    Number(value || 0)
  );

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    getPayments().then(setPayments).catch(() => null);
  }, []);

  const totalPaid = useMemo(
    () => payments.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0),
    [payments]
  );

  return (
    <div className="admin-grid">
      <section className="panel">
        <h2>Payments</h2>
        <p className="muted">Cash-in monitoring and payment traceability.</p>
      </section>

      <section className="kpi-grid two-col">
        <article className="panel kpi">
          <p className="kpi-label">Payment operations</p>
          <h2>{payments.length}</h2>
          <p className="muted">Number of payment entries</p>
        </article>
        <article className="panel kpi">
          <p className="kpi-label">Total collected</p>
          <h2>{formatMoney(totalPaid)}</h2>
          <p className="muted">Sum of all recorded transactions</p>
        </article>
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Student ID</th>
                <th>Fee ID</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.id}</td>
                  <td>{payment.student_id}</td>
                  <td>{payment.monthly_fee_id}</td>
                  <td>{formatMoney(payment.amount_paid)}</td>
                  <td>{payment.payment_date}</td>
                  <td>{payment.payment_method}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan="6" className="table-empty">
                    No payments found.
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
