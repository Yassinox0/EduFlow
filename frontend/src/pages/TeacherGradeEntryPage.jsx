import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useI18n from "../hooks/useI18n";
import { getAssessmentRoster, saveAssessmentGrades, updateAssessmentStatus } from "../services/teacherPortalService";
import teacherPortalError from "../utils/teacherPortalError";

export default function TeacherGradeEntryPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [grades, setGrades] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = () => getAssessmentRoster(id).then((result) => { setData(result); setGrades(Object.fromEntries(result.students.map((student) => [student.enrollment_id, { enrollment_id: student.enrollment_id, score: student.score ?? "", attendance_status: student.attendance_status || "PRESENT", remark: student.remark || "" }]))); }).catch((requestError) => setError(teacherPortalError(requestError, t, "teacherPortal.loadError")));
  useEffect(load, [id, t]);
  const update = (enrollmentId, key, value) => setGrades((current) => ({ ...current, [enrollmentId]: { ...current[enrollmentId], [key]: value, ...(key === "attendance_status" && value !== "PRESENT" ? { score: "" } : {}) } }));
  const save = async () => { setSaving(true); setError(""); setMessage(""); try { await saveAssessmentGrades(id, Object.values(grades)); setMessage(t("teacherPortal.gradesSaved")); await load(); } catch (requestError) { setError(teacherPortalError(requestError, t)); } finally { setSaving(false); } };
  const publish = async () => { setSaving(true); setError(""); try { await saveAssessmentGrades(id, Object.values(grades)); await updateAssessmentStatus(id, "PUBLISHED"); setMessage(t("teacherPortal.assessmentPublished")); await load(); } catch (requestError) { setError(teacherPortalError(requestError, t, "teacherPortal.publishError")); } finally { setSaving(false); } };
  if (!data) return <section className="panel"><p className={error ? "error-text" : ""}>{error || t("common.loading")}</p></section>;
  const locked = data.assessment.status !== "DRAFT";
  return <div className="teacher-portal-page">
    <section className="panel hero-modern panel-header"><div><p className="brand-kicker">{data.assessment.subject_name} · {data.assessment.class_name}</p><h1>{data.assessment.title}</h1><p className="muted">{t("teacherPortal.gradeEntryHelp", { score: data.assessment.max_score })}</p></div><Link className="secondary-btn button-link" to="/teacher/assessments">{t("common.back")}</Link></section>
    {error && <section className="panel"><p className="error-text">{error}</p></section>}{message && <section className="panel"><p className="success-text">{message}</p></section>}
    {locked && <section className="panel locked-notice">{data.assessment.status === "LOCKED" ? t("teacherPortal.lockedMessage") : t("teacherPortal.publishedReadOnly")}</section>}
    <section className="panel grade-entry-panel"><div className="table-wrap"><table className="grade-entry-table"><thead><tr><th>{t("common.student")}</th><th>{t("teacherPortal.presenceAtAssessment")}</th><th>{t("teacherPortal.score")}</th><th>{t("teacherPortal.optionalRemark")}</th></tr></thead><tbody>{data.students.map((student) => { const grade = grades[student.enrollment_id] || {}; return <tr key={student.enrollment_id}><td><strong>{student.last_name} {student.first_name}</strong></td><td><select disabled={locked} value={grade.attendance_status} onChange={(e) => update(student.enrollment_id, "attendance_status", e.target.value)}><option value="PRESENT">{t("teacherPortal.present")}</option><option value="ABSENT">{t("teacherPortal.absent")}</option><option value="EXCUSED">{t("teacherPortal.excused")}</option></select></td><td><input disabled={locked || grade.attendance_status !== "PRESENT"} type="number" min="0" max={data.assessment.max_score} step="0.25" value={grade.score} onChange={(e) => update(student.enrollment_id, "score", e.target.value)} placeholder={`/ ${data.assessment.max_score}`} /></td><td><input disabled={locked} maxLength="500" value={grade.remark} onChange={(e) => update(student.enrollment_id, "remark", e.target.value)} placeholder={t("teacherPortal.remarkPlaceholder")} /></td></tr>; })}</tbody></table></div>
      {!locked && <div className="form-actions grade-actions"><button className="secondary-btn" type="button" disabled={saving} onClick={save}>{t("teacherPortal.saveDraft")}</button><button type="button" disabled={saving} onClick={publish}>{t("teacherPortal.publish")}</button></div>}
    </section>
    {!!data.history?.length && <section className="panel"><div className="panel-header"><div><h2>{t("teacherPortal.changeHistory")}</h2><p className="muted">{t("teacherPortal.changeHistoryHelp")}</p></div></div><div className="history-list">{data.history.map((item) => <div key={item.id}><strong>{item.last_name} {item.first_name}</strong><span>{t(`teacherPortal.historyActions.${item.action}`)} · {item.actor_name}</span><time>{item.created_at}</time></div>)}</div></section>}
  </div>;
}
