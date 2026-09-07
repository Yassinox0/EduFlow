import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useI18n from "../hooks/useI18n";
import { createTeacherAssessment, getTeacherAssessments } from "../services/teacherPortalService";
import teacherPortalError from "../utils/teacherPortalError";

const emptyForm = { teacher_assignment_id: "", grading_period_id: "", title: "", assessment_type: "CONTROL", assessment_date: new Date().toISOString().slice(0, 10), max_score: "20", coefficient: "1" };

export default function TeacherAssessmentsPage() {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState({ assignments: [], periods: [], assessments: [] });
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => getTeacherAssessments().then((result) => { setCatalog(result); setForm((current) => ({ ...current, teacher_assignment_id: current.teacher_assignment_id || String(result.assignments?.[0]?.id || ""), grading_period_id: current.grading_period_id || String(result.periods?.find((period) => Number(period.is_current) === 1)?.id || result.periods?.[0]?.id || "") })); }).catch((requestError) => setError(teacherPortalError(requestError, t, "teacherPortal.loadError")));
  useEffect(load, [t]);
  const selectedAssignment = useMemo(() => catalog.assignments.find((item) => String(item.id) === String(form.teacher_assignment_id)), [catalog.assignments, form.teacher_assignment_id]);
  const periods = catalog.periods.filter((period) => !selectedAssignment || String(period.academic_year_id) === String(selectedAssignment.academic_year_id));

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try { await createTeacherAssessment({ ...form, teacher_assignment_id: Number(form.teacher_assignment_id), grading_period_id: Number(form.grading_period_id), max_score: Number(form.max_score), coefficient: Number(form.coefficient) }); setForm((current) => ({ ...emptyForm, teacher_assignment_id: current.teacher_assignment_id, grading_period_id: current.grading_period_id })); setShowForm(false); await load(); }
    catch (requestError) { setError(teacherPortalError(requestError, t)); }
    finally { setSaving(false); }
  };

  return <div className="teacher-portal-page">
    <section className="panel hero-modern panel-header"><div><p className="brand-kicker">{t("teacherPortal.grades")}</p><h1>{t("teacherPortal.assessmentsTitle")}</h1><p className="muted">{t("teacherPortal.assessmentsHelp")}</p></div><button type="button" onClick={() => setShowForm((value) => !value)}>{showForm ? t("common.cancel") : t("teacherPortal.newAssessment")}</button></section>
    {error && <section className="panel"><p className="error-text">{error}</p></section>}
    {showForm && <section className="panel"><form className="assessment-form" onSubmit={submit}>
      <label><span>{t("teacherPortal.assignment")}</span><select required value={form.teacher_assignment_id} onChange={(e) => setForm({ ...form, teacher_assignment_id: e.target.value })}>{catalog.assignments.map((item) => <option value={item.id} key={item.id}>{item.subject_name} · {item.class_name}</option>)}</select></label>
      <label><span>{t("teacherPortal.period")}</span><select required value={form.grading_period_id} onChange={(e) => setForm({ ...form, grading_period_id: e.target.value })}>{periods.map((item) => <option value={item.id} key={item.id}>{t(`teacherPortal.periods.${item.code}`, { fallback: item.name })}</option>)}</select></label>
      <label className="span-2"><span>{t("teacherPortal.assessmentTitle")}</span><input required maxLength="160" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label><span>{t("teacherPortal.type")}</span><select value={form.assessment_type} onChange={(e) => setForm({ ...form, assessment_type: e.target.value })}><option value="CONTROL">{t("teacherPortal.types.CONTROL")}</option><option value="HOMEWORK">{t("teacherPortal.types.HOMEWORK")}</option><option value="EXAM">{t("teacherPortal.types.EXAM")}</option></select></label>
      <label><span>{t("common.date")}</span><input type="date" required value={form.assessment_date} onChange={(e) => setForm({ ...form, assessment_date: e.target.value })} /></label>
      <label><span>{t("teacherPortal.scale")}</span><input type="number" min="1" max="1000" step="0.25" required value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} /></label>
      <label><span>{t("teacherPortal.coefficient")}</span><input type="number" min="0.1" max="100" step="0.1" required value={form.coefficient} onChange={(e) => setForm({ ...form, coefficient: e.target.value })} /></label>
      <div className="form-actions span-2"><button disabled={saving}>{saving ? t("common.saving") : t("common.create")}</button></div>
    </form></section>}
    <section className="panel"><div className="panel-header"><div><h2>{t("teacherPortal.myAssessments")}</h2><p className="muted">{t("teacherPortal.assessmentStatusHelp")}</p></div></div><div className="assessment-list">{catalog.assessments.map((item) => <article className="assessment-card" key={item.id}><div><span className={`assessment-status status-${item.status.toLowerCase()}`}>{t(`teacherPortal.statuses.${item.status}`)}</span><h3>{item.title}</h3><p>{item.subject_name} · {item.class_name}</p><small>{item.assessment_date} · {t("teacherPortal.scaleValue", { score: item.max_score })} · {t("teacherPortal.coefficientValue", { value: item.coefficient })}</small></div><Link className="button-link" to={`/teacher/assessments/${item.id}/grades`}>{t("teacherPortal.enterGrades")}</Link></article>)}{!catalog.assessments.length && <p className="table-empty">{t("teacherPortal.noAssessments")}</p>}</div></section>
  </div>;
}
