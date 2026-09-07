import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MONTH_OPTIONS } from "../../config/schoolOptions";
import useI18n from "../../hooks/useI18n";
import { getPaymentMethods } from "../../services/paymentMethodService";
import { createPayment } from "../../services/paymentService";
import { downloadReceiptPdf } from "../../services/receiptService";
import { getStudentById, getStudents } from "../../services/studentService";

const currentDate = new Date();
const initialForm = {
  student_id: "",
  month_label: String(currentDate.getMonth() + 1).padStart(2, "0"),
  year_value: String(currentDate.getFullYear()),
  amount_paid: "",
  payment_date: currentDate.toISOString().slice(0, 10),
  payment_method_id: "",
};

const formatMoney = (value, language) => new Intl.NumberFormat(
  language === "ar" ? "ar-MA" : "fr-MA",
  { style: "currency", currency: "MAD" }
).format(Number(value || 0));

const statusLabel = (value, t) => {
  if (value === "PAID") return t("statuses.paid");
  if (value === "PARTIAL") return t("statuses.partial");
  if (value === "UNPAID") return t("statuses.unpaid");
  return value || "-";
};

const paymentMethodLabel = (method, t) => {
  const code = String(method?.code || "").toUpperCase();
  const keys = { CASH: "methodCash", CARD: "methodCard", BANK_TRANSFER: "methodBankTransfer", CHECK: "methodCheck", MOBILE: "methodMobile" };
  return keys[code] ? t(`payments.${keys[code]}`) : method?.label || code || "-";
};

export default function PaymentCreatePage() {
  const { language, t } = useI18n();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(initialForm);
  const [methods, setMethods] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentSearchApplied, setStudentSearchApplied] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [createdPayment, setCreatedPayment] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getPaymentMethods()
      .then((data) => {
        const safeMethods = Array.isArray(data) ? data : [];
        setMethods(safeMethods);
        if (safeMethods.length) {
          setForm((previous) => ({ ...previous, payment_method_id: String(safeMethods[0].id) }));
        }
      })
      .catch(() => setError(t("payments.loadError")));
  }, [t]);

  useEffect(() => {
    const studentId = Number(searchParams.get("student_id") || 0);
    if (studentId <= 0) return;

    setSearching(true);
    getStudentById(studentId)
      .then((data) => {
        const student = data?.student;
        if (!student) return;
        setStudents([student]);
        setStudentSearch(`${student.first_name} ${student.last_name}`.trim());
        setStudentSearchApplied(true);
        setForm((previous) => ({ ...previous, student_id: String(student.id) }));
      })
      .catch(() => setError(t("payments.studentSearchError")))
      .finally(() => setSearching(false));
  }, [searchParams, t]);

  const searchStudents = async (event) => {
    event.preventDefault();
    const search = studentSearch.trim();
    setError("");
    setMessage("");

    if (!search) {
      setStudents([]);
      setStudentSearchApplied(false);
      setError(t("payments.studentSearchRequired"));
      return;
    }

    setSearching(true);
    try {
      const data = await getStudents({ search });
      setStudents(Array.isArray(data) ? data : []);
      setStudentSearchApplied(true);
    } catch {
      setStudents([]);
      setStudentSearchApplied(false);
      setError(t("payments.studentSearchError"));
    } finally {
      setSearching(false);
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setCreatedPayment(null);
    setSaving(true);

    try {
      const result = await createPayment({
        student_id: Number(form.student_id),
        month_label: form.month_label,
        year_value: Number(form.year_value),
        amount_paid: Number(form.amount_paid),
        payment_date: form.payment_date,
        payment_method_id: Number(form.payment_method_id),
      });
      setCreatedPayment(result);
      setMessage(t("payments.success", {
        status: statusLabel(result.monthly_fee_status, t),
        remaining: formatMoney(result.monthly_fee_remaining_amount, language),
      }));
      setForm((previous) => ({ ...initialForm, payment_method_id: previous.payment_method_id }));
      setStudents([]);
      setStudentSearch("");
      setStudentSearchApplied(false);
    } catch {
      setError(t("payments.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const downloadCreatedReceipt = async () => {
    if (!createdPayment?.id) return;
    setDownloading(true);
    setError("");
    try {
      await downloadReceiptPdf(createdPayment.id, language);
    } catch {
      setError(t("payments.downloadError"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="admin-grid">
      <section className="panel hero-modern">
        <p className="brand-kicker">{t("navigation.finance")}</p>
        <h2>{t("payments.newPayment")}</h2>
        <p className="muted">{t("payments.newPaymentDescription")}</p>
      </section>

      <section className="panel">
        <form className="filters-grid" onSubmit={searchStudents}>
          <input
            placeholder={t("payments.searchStudent")}
            value={studentSearch}
            onChange={(event) => setStudentSearch(event.target.value)}
          />
          <button type="submit" disabled={searching}>
            {searching ? t("common.searching") : t("payments.searchStudentAction")}
          </button>
        </form>

        <form className="form-grid payment-create-form" onSubmit={submitPayment}>
          <label>
            <span>{t("common.student")}</span>
            <select
              value={form.student_id}
              onChange={(event) => setForm({ ...form, student_id: event.target.value })}
              required
            >
              <option value="">
                {studentSearchApplied ? t("payments.selectStudent") : t("payments.searchStudentFirst")}
              </option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("payments.month")}</span>
            <select value={form.month_label} onChange={(event) => setForm({ ...form, month_label: event.target.value })} required>
              {MONTH_OPTIONS.map((month) => (
                <option key={month.value} value={month.value}>{t(`months.${month.value}`)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("common.year")}</span>
            <input type="number" min="2000" max="2100" value={form.year_value} onChange={(event) => setForm({ ...form, year_value: event.target.value })} required />
          </label>
          <label>
            <span>{t("payments.paidAmount")}</span>
            <input type="number" min="0.01" step="0.01" value={form.amount_paid} onChange={(event) => setForm({ ...form, amount_paid: event.target.value })} required />
          </label>
          <label>
            <span>{t("common.date")}</span>
            <input type="date" value={form.payment_date} onChange={(event) => setForm({ ...form, payment_date: event.target.value })} required />
          </label>
          <label>
            <span>{t("payments.paymentMethod")}</span>
            <select value={form.payment_method_id} onChange={(event) => setForm({ ...form, payment_method_id: event.target.value })} required>
              <option value="">{t("payments.paymentMethod")}</option>
              {methods.map((method) => <option key={method.id} value={method.id}>{paymentMethodLabel(method, t)}</option>)}
            </select>
          </label>
          <div className="form-actions full-field">
            <button type="submit" disabled={saving}>{saving ? t("payments.registering") : t("common.save")}</button>
          </div>
        </form>

        {studentSearchApplied && students.length === 0 && <p className="muted">{t("payments.noStudent")}</p>}
        {message && <p className="success-text">{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>

      {createdPayment?.id && (
        <section className="panel payment-created-actions">
          <div>
            <h3>{t("payments.createdActions")}</h3>
            <p className="muted">{t("payments.receiptNumber")} : REC-{String(createdPayment.id).padStart(6, "0")}</p>
          </div>
          <div className="table-actions">
            <Link className="secondary-btn button-link" to={`/finances/payments/${createdPayment.id}`}>{t("payments.viewDetails")}</Link>
            <button type="button" onClick={downloadCreatedReceipt} disabled={downloading}>{t("payments.downloadReceipt")}</button>
            <Link className="secondary-btn button-link" to="/finances/payments/history">{t("payments.backToHistory")}</Link>
          </div>
        </section>
      )}
    </div>
  );
}
