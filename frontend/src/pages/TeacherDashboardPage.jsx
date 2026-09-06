import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useI18n from "../hooks/useI18n";
import { getTeacherDashboard } from "../services/teacherPortalService";

export default function TeacherDashboardPage() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getTeacherDashboard().then(setData).catch((requestError) => setError(requestError?.response?.data?.message || t("teacherPortal.loadError")));
  }, [t]);

  if (!data && !error) return <section className="panel"><p>{t("common.loading")}</p></section>;
  return (
    <div className="teacher-portal-page">
      <section className="panel hero-modern panel-header">
        <div><p className="brand-kicker">{t("teacherPortal.workspace")}</p><h1>{t("teacherPortal.dashboardTitle")}</h1><p className="muted">{t("teacherPortal.dashboardHelp")}</p></div>
      </section>
      {error && <section className="panel"><p className="error-text">{error}</p></section>}
      {data && <>
        <section className="teacher-stat-grid">
          <article className="panel teacher-stat"><span>{t("teacherPortal.assignedClasses")}</span><strong>{data.stats.assignment_count}</strong></article>
          <article className="panel teacher-stat teacher-stat-hours"><span>{t("teacherPortal.assignedHours")}</span><strong>{data.stats.assigned_weekly_hours} h</strong></article>
          <article className="panel teacher-stat teacher-stat-hours"><span>{t("teacherPortal.scheduledHours")}</span><strong>{data.stats.scheduled_weekly_hours} h</strong></article>
          <article className="panel teacher-stat teacher-stat-hours"><span>{t("teacherPortal.remainingHours")}</span><strong>{data.stats.remaining_weekly_hours} h</strong></article>
          <article className="panel teacher-stat"><span>{t("teacherPortal.assessments")}</span><strong>{data.stats.assessment_count}</strong></article>
          <article className="panel teacher-stat"><span>{t("teacherPortal.drafts")}</span><strong>{data.stats.draft_count}</strong></article>
          <article className="panel teacher-stat"><span>{t("teacherPortal.todayCourses")}</span><strong>{data.stats.today_session_count}</strong></article>
        </section>
        <section className="teacher-action-grid">
          <Link className="panel teacher-action-card" to="/schedules"><strong>{t("teacherPortal.mySchedule")}</strong><span>{t("teacherPortal.myScheduleHelp")}</span></Link>
          <Link className="panel teacher-action-card" to="/teacher/attendance"><strong>{t("teacherPortal.takeAttendance")}</strong><span>{t("teacherPortal.takeAttendanceHelp")}</span></Link>
          <Link className="panel teacher-action-card" to="/teacher/assessments"><strong>{t("teacherPortal.manageAssessments")}</strong><span>{t("teacherPortal.manageAssessmentsHelp")}</span></Link>
          <Link className="panel teacher-action-card" to="/teacher/gradebook"><strong>{t("teacherPortal.viewAverages")}</strong><span>{t("teacherPortal.viewAveragesHelp")}</span></Link>
          <Link className="panel teacher-action-card" to="/teacher/profile"><strong>{t("teacherPortal.myAccount")}</strong><span>{t("teacherPortal.myAccountHelp")}</span></Link>
        </section>
        <section className="panel">
          <div className="panel-header"><div><h2>{t("teacherPortal.myAssignments")}</h2><p className="muted">{t("teacherPortal.adminManaged")}</p></div></div>
          <div className="assignment-chip-list">{data.assignments.map((item) => <div className="assignment-chip" key={item.id}><strong>{item.subject_name}</strong><span>{item.class_name} · {item.academic_year_name}</span><small>{t("teacherPortal.weeklyHours", { count: item.weekly_hours })}</small></div>)}</div>
        </section>
      </>}
    </div>
  );
}
