import { useEffect, useMemo, useState } from "react";
import useI18n from "../hooks/useI18n";
import { getAttendanceRoster, getTeacherSessions, saveAttendance } from "../services/teacherPortalService";
import teacherPortalError from "../utils/teacherPortalError";

const today = () => new Date().toISOString().slice(0, 10);

export default function TeacherAttendancePage() {
  const { t } = useI18n();
  const [date, setDate] = useState(today);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [students, setStudents] = useState([]);
  const [absences, setAbsences] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSessions = () => {
    setLoading(true); setError(""); setSelected(null); setStudents([]);
    getTeacherSessions(date).then((result) => setSessions(result.sessions || [])).catch((requestError) => setError(teacherPortalError(requestError, t, "teacherPortal.loadError"))).finally(() => setLoading(false));
  };
  useEffect(loadSessions, [date, t]);

  const openSession = async (session) => {
    setLoading(true); setError(""); setMessage("");
    try {
      const result = await getAttendanceRoster(session.id, date);
      setSelected(result.session);
      setStudents(result.students || []);
      setAbsences(Object.fromEntries((result.students || []).filter((student) => student.absence_status).map((student) => [student.enrollment_id, { enrollment_id: student.enrollment_id, status: student.absence_status, reason: student.reason || "", note: student.note || "" }])));
    } catch (requestError) { setError(teacherPortalError(requestError, t, "teacherPortal.loadError")); }
    finally { setLoading(false); }
  };

  const toggleAbsent = (student, checked) => setAbsences((current) => {
    const next = { ...current };
    if (checked) next[student.enrollment_id] = { enrollment_id: student.enrollment_id, status: "ABSENT", reason: "", note: "" };
    else delete next[student.enrollment_id];
    return next;
  });
  const updateAbsence = (id, key, value) => setAbsences((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  const absentCount = useMemo(() => Object.keys(absences).length, [absences]);

  const submit = async () => {
    setSaving(true); setError(""); setMessage("");
    try {
      await saveAttendance(selected.id, date, Object.values(absences));
      setMessage(absentCount ? t("teacherPortal.attendanceSaved", { count: absentCount }) : t("teacherPortal.noAbsenceSaved"));
      loadSessions();
    } catch (requestError) { setError(teacherPortalError(requestError, t)); }
    finally { setSaving(false); }
  };

  return <div className="teacher-portal-page">
    <section className="panel hero-modern panel-header"><div><p className="brand-kicker">{t("teacherPortal.attendance")}</p><h1>{t("teacherPortal.attendanceTitle")}</h1><p className="muted">{t("teacherPortal.attendanceHelp")}</p></div><label className="date-control"><span>{t("common.date")}</span><input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></label></section>
    {error && <section className="panel"><p className="error-text">{error}</p></section>}
    {message && <section className="panel"><p className="success-text">{message}</p></section>}
    <section className="panel"><div className="panel-header"><div><h2>{t("teacherPortal.scheduledCourses")}</h2><p className="muted">{t("teacherPortal.scheduleReadOnly")}</p></div></div>
      {loading ? <p>{t("common.loading")}</p> : <div className="session-list">{sessions.map((session) => <button type="button" className={`session-card ${selected?.id === session.id ? "active" : ""}`} key={session.id} onClick={() => openSession(session)}><strong>{String(session.start_time).slice(0, 5)} – {String(session.end_time).slice(0, 5)}</strong><span>{session.subject_name} · {session.class_name}</span><small>{session.attendance_session_id ? t("teacherPortal.attendanceCompleted", { count: session.absent_count }) : t("teacherPortal.attendancePending")}</small></button>)}{!sessions.length && <p className="table-empty">{t("teacherPortal.noCourseForDate")}</p>}</div>}
    </section>
    {selected && <section className="panel"><div className="panel-header"><div><h2>{selected.subject_name} · {selected.class_name}</h2><p className="muted">{t("teacherPortal.selectAbsentOnly")}</p></div><span className="absence-counter">{t("teacherPortal.absentCount", { count: absentCount })}</span></div>
      <div className="attendance-list">{students.map((student) => { const absence = absences[student.enrollment_id]; return <article className={`attendance-student ${absence ? "is-absent" : ""}`} key={student.enrollment_id}><label><input type="checkbox" checked={Boolean(absence)} onChange={(e) => toggleAbsent(student, e.target.checked)} /><span><strong>{student.last_name} {student.first_name}</strong><small>{absence ? t("teacherPortal.absent") : t("teacherPortal.present")}</small></span></label>{absence && <div className="attendance-details"><select value={absence.status} onChange={(e) => updateAbsence(student.enrollment_id, "status", e.target.value)}><option value="ABSENT">{t("teacherPortal.unexcused")}</option><option value="EXCUSED">{t("teacherPortal.excused")}</option></select><input placeholder={t("teacherPortal.absenceReason")} value={absence.reason} onChange={(e) => updateAbsence(student.enrollment_id, "reason", e.target.value)} /></div>}</article>; })}</div>
      <div className="form-actions"><button type="button" onClick={submit} disabled={saving}>{saving ? t("common.saving") : t("teacherPortal.validateAttendance")}</button></div>
    </section>}
  </div>;
}
