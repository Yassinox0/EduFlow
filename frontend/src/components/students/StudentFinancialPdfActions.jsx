import { useState } from "react";
import useAuth from "../../hooks/useAuth";
import { downloadFamilyPaymentsPdf, downloadStudentPaymentsPdf } from "../../services/paymentDocumentService";
import { MONTH_OPTIONS } from "../../config/schoolOptions";

export default function StudentFinancialPdfActions({ student }) {
  const { can } = useAuth();
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [period, setPeriod] = useState({ month_label: "", year_value: "" });
  if (!can("payments.view") || !can("payments.export")) return null;
  const download = async (type) => {
    if (loading) return;
    setLoading(type); setError("");
    try { const params = Object.fromEntries(Object.entries(period).filter(([, value]) => value)); if (type === "student") await downloadStudentPaymentsPdf(student.id, params); else await downloadFamilyPaymentsPdf(student.family_id, params); }
    catch (requestError) { setError(requestError?.response?.data?.message || requestError?.message || "Impossible de générer le document PDF."); }
    finally { setLoading(""); }
  };
  return <div className="student-pdf-actions"><select aria-label="Mois de l’historique PDF" value={period.month_label} disabled={Boolean(loading)} onChange={(event) => setPeriod({ ...period, month_label: event.target.value })}><option value="">Toute période</option>{MONTH_OPTIONS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}</select><input aria-label="Année de l’historique PDF" type="number" min="2000" max="2100" placeholder="Année" value={period.year_value} disabled={Boolean(loading)} onChange={(event) => setPeriod({ ...period, year_value: event.target.value })}/><button type="button" className="secondary-btn" disabled={Boolean(loading)} onClick={() => download("student")}>{loading === "student" ? "Génération…" : "Historique des paiements PDF"}</button>{student.family_id && <button type="button" className="secondary-btn" disabled={Boolean(loading)} onClick={() => download("family")}>{loading === "family" ? "Génération…" : "Récapitulatif familial PDF"}</button>}{error && <small className="error-text">{error}</small>}</div>;
}
