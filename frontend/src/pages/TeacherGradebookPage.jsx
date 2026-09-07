import { useEffect, useMemo, useState } from "react";
import useI18n from "../hooks/useI18n";
import { downloadStudentReportCard, getTeacherAssessments, getTeacherGradebook } from "../services/teacherPortalService";

export default function TeacherGradebookPage() {
  const { language, t } = useI18n();
  const [catalog, setCatalog] = useState({ assignments: [], periods: [] });
  const [assignmentId, setAssignmentId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { getTeacherAssessments().then((result) => { setCatalog(result); setAssignmentId(String(result.assignments?.[0]?.id || "")); }).catch(() => setError(t("teacherPortal.loadError"))); }, [t]);
  const assignment = useMemo(() => catalog.assignments.find((item) => String(item.id) === assignmentId), [catalog.assignments, assignmentId]);
  const periods = catalog.periods.filter((item) => !assignment || String(item.academic_year_id) === String(assignment.academic_year_id));
  useEffect(() => { if (periods.length && !periods.some((item) => String(item.id) === periodId)) setPeriodId(String(periods[0].id)); }, [periods, periodId]);
  useEffect(() => { if (!assignmentId || !periodId) return; setError(""); getTeacherGradebook({ teacher_assignment_id: assignmentId, grading_period_id: periodId }).then(setData).catch((requestError) => setError(requestError?.response?.data?.message || t("teacherPortal.loadError"))); }, [assignmentId, periodId, t]);
  const formatAverage = (value) => value === null || value === undefined ? "—" : new Intl.NumberFormat(language === "ar" ? "ar-MA" : "fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
  return <div className="teacher-portal-page">
    <section className="panel hero-modern"><p className="brand-kicker">{t("teacherPortal.results")}</p><h1>{t("teacherPortal.gradebookTitle")}</h1><p className="muted">{t("teacherPortal.gradebookHelp")}</p></section>
    {error && <section className="panel"><p className="error-text">{error}</p></section>}
    <section className="panel teacher-filter-bar"><label><span>{t("teacherPortal.assignment")}</span><select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>{catalog.assignments.map((item) => <option key={item.id} value={item.id}>{item.subject_name} · {item.class_name}</option>)}</select></label><label><span>{t("teacherPortal.period")}</span><select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>{periods.map((item) => <option key={item.id} value={item.id}>{t(`teacherPortal.periods.${item.code}`)}</option>)}</select></label></section>
    <section className="panel"><div className="panel-header"><div><h2>{assignment?.subject_name} · {assignment?.class_name}</h2><p className="muted">{t("teacherPortal.averageCalculationHelp")}</p></div><button type="button" className="secondary-btn" onClick={() => window.print()}>{t("teacherPortal.printResults")}</button></div><div className="table-wrap"><table><thead><tr><th>{t("common.student")}</th><th>{t("teacherPortal.publishedGrades")}</th><th>{t("teacherPortal.averageOutOfTwenty")}</th><th>{t("common.actions")}</th></tr></thead><tbody>{(data?.students || []).map((student) => <tr key={student.enrollment_id}><td><strong>{student.last_name} {student.first_name}</strong></td><td>{student.grade_count}</td><td><strong>{formatAverage(student.average)} / 20</strong></td><td><button type="button" className="secondary-btn" onClick={() => downloadStudentReportCard(student.student_id, periodId, language)}>{t("teacherPortal.downloadReport")}</button></td></tr>)}{data && !data.students.length && <tr><td colSpan="4" className="table-empty">{t("teacherPortal.noStudents")}</td></tr>}</tbody></table></div></section>
  </div>;
}
