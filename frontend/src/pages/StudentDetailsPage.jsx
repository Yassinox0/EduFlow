import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useI18n from "../hooks/useI18n";
import { downloadReceiptPdf } from "../services/receiptService";
import { downloadStudentPaymentsPdf } from "../services/paymentDocumentService";
import { getStudentById, uploadStudentPhoto } from "../services/studentService";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
const localeFor = (language) => (language === "ar" ? "ar-MA" : "fr-MA");
const formatMoney = (value, language) => new Intl.NumberFormat(localeFor(language), {
  style: "currency",
  currency: "MAD",
}).format(Number(value || 0));
const formatDate = (value, language) => value
  ? new Intl.DateTimeFormat(localeFor(language)).format(new Date(`${String(value).slice(0, 10)}T00:00:00`))
  : "-";
const resolvePhoto = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}/${String(path).replace(/\\/g, "/").replace(/^\/+/, "")}`;
};
const paymentMethodLabel = (value, t) => {
  const normalized = String(value || "").trim().toUpperCase();
  const keys = {
    CASH: "methodCash", ESPECES: "methodCash", "ESPÈCES": "methodCash",
    CARD: "methodCard", "CARTE BANCAIRE": "methodCard",
    BANK_TRANSFER: "methodBankTransfer", "VIREMENT BANCAIRE": "methodBankTransfer",
    CHECK: "methodCheck", CHEQUE: "methodCheck", "CHÈQUE": "methodCheck",
    MOBILE: "methodMobile", "PAIEMENT MOBILE": "methodMobile",
  };
  return keys[normalized] ? t(`payments.${keys[normalized]}`) : value || "-";
};

export default function StudentDetailsPage() {
  const { id } = useParams();
  const { language, t } = useI18n();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [exportingPayments, setExportingPayments] = useState(false);
  const [error, setError] = useState("");

  const loadStudent = () => {
    setLoading(true);
    setError("");
    getStudentById(id)
      .then(setDetails)
      .catch(() => setError(t("studentProfile.loadError")))
      .finally(() => setLoading(false));
  };

  useEffect(loadStudent, [id, t]);

  const student = details?.student || {};
  const finance = details?.finance || {};
  const initials = useMemo(() => `${student.first_name?.[0] || ""}${student.last_name?.[0] || ""}`.toUpperCase(), [student.first_name, student.last_name]);
  const photoUrl = resolvePhoto(student.photo_path);

  const changePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await uploadStudentPhoto(id, file);
      await getStudentById(id).then(setDetails);
    } catch {
      setError(t("studentProfile.photoError"));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const downloadReceipt = async (paymentId) => {
    setDownloadingId(paymentId);
    setError("");
    try {
      await downloadReceiptPdf(paymentId, language);
    } catch {
      setError(t("payments.downloadError"));
    } finally {
      setDownloadingId(null);
    }
  };

  const exportPaymentHistory = async () => {
    if (exportingPayments) return;
    setExportingPayments(true);
    setError("");
    try {
      await downloadStudentPaymentsPdf(id, {});
    } catch {
      setError("Impossible d’exporter l’historique des paiements.");
    } finally {
      setExportingPayments(false);
    }
  };

  if (loading) return <section className="panel"><p>{t("common.loading")}</p></section>;
  if (!details) return <section className="panel"><p className="error-text">{error || t("studentProfile.loadError")}</p></section>;

  return (
    <div className="admin-grid student-profile-page">
      <section className="panel hero-modern panel-header">
        <div>
          <p className="brand-kicker">{t("students.title")}</p>
          <h1>{student.first_name} {student.last_name}</h1>
          <p className="muted">{t("studentProfile.description")}</p>
        </div>
        <div className="table-actions student-profile-main-actions">
          <Link className="secondary-btn button-link" to="/students">{t("studentProfile.backToStudents")}</Link>
          <Link className="button-link" to={`/finances/payments/new?student_id=${student.id}`}>{t("payments.newPayment")}</Link>
        </div>
      </section>

      {error && <section className="panel"><p className="error-text">{error}</p></section>}

      <section className="student-profile-overview">
        <article className="panel student-identity-card">
          <div className="student-photo-frame">
            {photoUrl ? <img src={photoUrl} alt={`${student.first_name} ${student.last_name}`} /> : <span>{initials || "—"}</span>}
          </div>
          <label className="student-photo-action">
            <span>{uploading ? t("studentProfile.uploadingPhoto") : t("studentProfile.changePhoto")}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={changePhoto} disabled={uploading} />
          </label>
          <span className={`student-status status-${String(student.status || "inactive").toLowerCase()}`}>{student.status === "ACTIVE" ? t("statuses.active") : t("statuses.inactive")}</span>
        </article>

        <article className="panel student-information-card">
          <div className="panel-header"><div><p className="brand-kicker">{t("studentProfile.identity")}</p><h2>{t("studentProfile.schoolRecord")}</h2></div></div>
          <dl className="detail-list">
            <div><dt>{t("common.fullName")}</dt><dd>{student.first_name} {student.last_name}</dd></div>
            <div><dt>{t("students.birthDate")}</dt><dd>{formatDate(student.date_of_birth, language)}</dd></div>
            <div><dt>{t("students.gender")}</dt><dd>{["F", "FEMALE"].includes(student.gender) ? t("genders.female") : ["M", "MALE"].includes(student.gender) ? t("genders.male") : "-"}</dd></div>
            <div><dt>{t("common.phone")}</dt><dd>{student.phone || "-"}</dd></div>
            <div><dt>{t("common.address")}</dt><dd>{student.address || "-"}</dd></div>
            <div><dt>{t("common.schoolYear")}</dt><dd>{student.academic_year_name || student.school_year || "-"}</dd></div>
            <div><dt>{t("common.level")}</dt><dd>{student.class_level_name || "-"}</dd></div>
            <div><dt>{t("common.class")}</dt><dd>{student.class_group_name || "-"}</dd></div>
            <div><dt>{t("studentProfile.enrollmentDate")}</dt><dd>{formatDate(student.enrollment_date, language)}</dd></div>
          </dl>
        </article>
      </section>

      <section className="kpi-grid student-finance-kpis">
        <article className="panel kpi"><p className="kpi-label">{t("studentProfile.totalBilled")}</p><h2>{formatMoney(finance.total_billed, language)}</h2></article>
        <article className="panel kpi"><p className="kpi-label">{t("studentProfile.totalPaid")}</p><h2>{formatMoney(finance.total_paid, language)}</h2></article>
        <article className="panel kpi"><p className="kpi-label">{t("studentProfile.totalRemaining")}</p><h2>{formatMoney(finance.total_remaining, language)}</h2></article>
      </section>

      <section className="split-panel student-context-panels">
        <article className="panel">
          <p className="brand-kicker">{t("common.parent")}</p>
          <h3>{details.parent?.name || student.parent_name || "-"}</h3>
          <dl className="detail-list compact-detail-list">
            <div><dt>{t("common.phone")}</dt><dd>{details.parent?.phone || "-"}</dd></div>
            <div><dt>{t("common.email")}</dt><dd>{details.parent?.email || "-"}</dd></div>
          </dl>
        </article>
        <article className="panel">
          <p className="brand-kicker">{t("studentProfile.siblings")}</p>
          <div className="student-sibling-list">
            {(details.siblings || []).map((sibling) => (
              <Link key={sibling.id} to={`/students/${sibling.id}`}>
                <strong>{sibling.first_name} {sibling.last_name}</strong>
                <span>{sibling.class_level_name || "-"} · {sibling.class_group_name || "-"}</span>
              </Link>
            ))}
            {!(details.siblings || []).length && <p className="muted">{t("studentProfile.noSiblings")}</p>}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header"><div><h3>{t("studentProfile.monthlyFees")}</h3><p className="muted">{t("studentProfile.monthlyFeesHelp")}</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>{t("payments.period")}</th><th>{t("studentProfile.billed")}</th><th>{t("studentProfile.paid")}</th><th>{t("payments.remaining")}</th><th>{t("common.status")}</th></tr></thead><tbody>
          {(details.monthly_fees || []).map((fee) => <tr key={fee.id}><td>{t(`months.${String(fee.month_label).padStart(2, "0")}`)} {fee.year_value}</td><td>{formatMoney(fee.total_amount, language)}</td><td>{formatMoney(fee.amount_paid, language)}</td><td>{formatMoney(fee.remaining_amount, language)}</td><td>{t(`statuses.${String(fee.status || "unpaid").toLowerCase()}`)}</td></tr>)}
          {!(details.monthly_fees || []).length && <tr><td colSpan="5" className="table-empty">{t("studentProfile.noFees")}</td></tr>}
        </tbody></table></div>
      </section>

      <section className="panel">
        <div className="panel-header"><div><h3>{t("studentProfile.paymentHistory")}</h3><p className="muted">{t("studentProfile.paymentHistoryHelp")}</p></div><button type="button" onClick={exportPaymentHistory} disabled={exportingPayments}>{exportingPayments ? "Export en cours…" : "Exporter l’historique PDF"}</button></div>
        <div className="table-wrap"><table><thead><tr><th>{t("payments.receiptNumber")}</th><th>{t("common.date")}</th><th>{t("payments.period")}</th><th>{t("common.amount")}</th><th>{t("payments.method")}</th><th>{t("common.actions")}</th></tr></thead><tbody>
          {(details.payments || []).map((payment) => <tr key={payment.id}><td>{payment.receipt_number || `REC-${String(payment.id).padStart(6, "0")}`}</td><td>{formatDate(payment.payment_date, language)}</td><td>{t(`months.${String(payment.month_label).padStart(2, "0")}`)} {payment.year_value}</td><td>{formatMoney(payment.amount_paid, language)}</td><td>{paymentMethodLabel(payment.payment_method_label || payment.payment_method, t)}</td><td><div className="table-actions"><Link className="secondary-btn button-link" to={`/finances/payments/${payment.id}`}>{t("common.details")}</Link><button type="button" onClick={() => downloadReceipt(payment.id)} disabled={downloadingId === payment.id}>{t("payments.downloadReceipt")}</button></div></td></tr>)}
          {!(details.payments || []).length && <tr><td colSpan="6" className="table-empty">{t("studentProfile.noPayments")}</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
