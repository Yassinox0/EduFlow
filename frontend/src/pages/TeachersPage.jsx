import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useI18n from "../hooks/useI18n";
import { getClassLevels } from "../services/classLevelService";
import { getCurrentSchool } from "../services/schoolService";
import { getSubjects } from "../services/subjectService";
import { createTeacher, deleteTeacher, getTeachers, updateTeacher } from "../services/teacherService";

const emptyForm = {
  first_name: "",
  last_name: "",
  gender: "",
  phone: "",
  address: "",
  email: "",
  primary_school: "",
  class_level_ids: [],
  subject_ids: [],
  status: "ACTIVE",
};

const teacherName = (teacher) => teacher?.name || `${teacher?.first_name || ""} ${teacher?.last_name || ""}`.trim();
const subjectName = (subject) => subject?.code || subject?.abbreviation || subject?.name || "-";
const className = (item) => {
  const code = String(item?.code || "").trim();
  if (code) return code;
  const level = String(item?.level_name || "").trim();
  const group = String(item?.group_name || item?.name || "").trim();
  return level && group ? `${level} - ${group}` : level || group || "-";
};
const relationIds = (teacher, key, relationKey) => Array.isArray(teacher?.[key])
  ? teacher[key].map(String)
  : Array.isArray(teacher?.[relationKey])
    ? teacher[relationKey].map((item) => String(item.id))
    : [];

export default function TeachersPage() {
  const { t } = useI18n();
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [school, setSchool] = useState(null);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    const [teacherData, classData, subjectData, schoolData] = await Promise.all([
      getTeachers(),
      getClassLevels(),
      getSubjects(),
      getCurrentSchool(),
    ]);
    setTeachers(Array.isArray(teacherData) ? teacherData : []);
    setClasses(Array.isArray(classData) ? classData : []);
    setSubjects(Array.isArray(subjectData) ? subjectData : []);
    setSchool(schoolData || null);
  };

  useEffect(() => {
    loadData().catch(() => setError(t("schedules.referenceLoadError")));
  }, [t]);

  const filteredTeachers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return teachers
      .filter((teacher) => {
        const matchesSearch = !normalizedSearch
          || teacherName(teacher).toLocaleLowerCase().includes(normalizedSearch)
          || String(teacher.phone || "").includes(normalizedSearch);
        const matchesSubject = !subjectFilter
          || relationIds(teacher, "subject_ids", "subjects").includes(String(subjectFilter));
        return matchesSearch && matchesSubject;
      })
      .sort((first, second) => {
        const lastNameOrder = String(first.last_name || "").localeCompare(String(second.last_name || ""));
        return lastNameOrder || String(first.first_name || "").localeCompare(String(second.first_name || ""));
      });
  }, [search, subjectFilter, teachers]);

  const openModal = (teacher = null) => {
    setError("");
    setMessage("");
    setEditingId(teacher?.id || null);
    setForm(teacher ? {
      first_name: teacher.first_name || "",
      last_name: teacher.last_name || "",
      gender: teacher.gender || "",
      phone: teacher.phone || "",
      address: teacher.address || "",
      email: teacher.email || "",
      primary_school: teacher.primary_school || school?.name || "",
      class_level_ids: relationIds(teacher, "class_level_ids", "class_levels"),
      subject_ids: relationIds(teacher, "subject_ids", "subjects"),
      status: teacher.status || "ACTIVE",
    } : { ...emptyForm, primary_school: school?.name || "" });
    setModalOpen(true);
  };

  const toggleRelation = (field, id, checked) => {
    setForm((previous) => ({
      ...previous,
      [field]: checked
        ? [...previous[field], id]
        : previous[field].filter((itemId) => itemId !== id),
    }));
  };

  const submitTeacher = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        class_level_ids: form.class_level_ids.map(Number),
        subject_ids: form.subject_ids.map(Number),
      };
      if (editingId) await updateTeacher(editingId, payload);
      else await createTeacher(payload);
      await loadData();
      setMessage(t(editingId ? "schedules.teacherUpdated" : "schedules.teacherCreated"));
      setModalOpen(false);
    } catch {
      setError(t("schedules.teacherSaveError"));
    } finally {
      setSaving(false);
    }
  };

  const removeTeacher = async (teacher) => {
    if (!window.confirm(t("schedules.teacherDeleteConfirm"))) return;
    setError("");
    setMessage("");
    try {
      await deleteTeacher(teacher.id);
      await loadData();
      setMessage(t("schedules.teacherDeleted"));
    } catch {
      setError(t("schedules.teacherDeleteError"));
    }
  };

  return (
    <div className="admin-grid">
      <section className="panel hero-modern panel-header">
        <div>
          <p className="brand-kicker">{t("navigation.pedagogy")}</p>
          <h2>{t("schedules.teachersManagement")}</h2>
          <p className="muted">{t("schedules.teachersManagementHelp")}</p>
        </div>
        <button type="button" onClick={() => openModal()}>+ {t("schedules.addTeacher")}</button>
      </section>

      <section className="panel">
        <div className="schedule-teacher-filters">
          <label><span>{t("schedules.teacherSearch")}</span><input value={search} placeholder={t("schedules.teacherSearchPlaceholder")} onChange={(event) => setSearch(event.target.value)} /></label>
          <label><span>{t("common.subject")}</span><select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
            <option value="">{t("schedules.allSubjects")}</option>
            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subjectName(subject)}</option>)}
          </select></label>
        </div>
        {message && <p className="success-text">{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="teacher-directory-section">
        <div className="teacher-directory-heading">
          <div>
            <h3>{t("schedules.teacherDirectory")}</h3>
            <p className="muted">{t("schedules.teacherCount", { count: filteredTeachers.length })}</p>
          </div>
          {filteredTeachers.length > 3 && <span>{t("schedules.teacherScrollHint")}</span>}
        </div>

        {filteredTeachers.length > 0 ? (
          <div
            className="teacher-scroll-track"
            role="list"
            tabIndex="0"
            aria-label={t("schedules.teacherDirectory")}
          >
            {filteredTeachers.map((teacher) => {
              const fullName = teacherName(teacher);
              const initials = `${teacher.first_name?.[0] || ""}${teacher.last_name?.[0] || ""}`;
              const isInactive = teacher.status === "INACTIVE";

              return (
                <article key={teacher.id} className="panel teacher-compact-card" role="listitem">
                  <header className="teacher-compact-header">
                    <span className="teacher-compact-avatar" aria-hidden="true">{initials}</span>
                    <div>
                      <h3>{fullName}</h3>
                      <span className={`student-status-badge ${isInactive ? "is-inactive" : "is-active"}`}>
                        {isInactive ? t("statuses.inactive") : t("statuses.active")}
                      </span>
                    </div>
                  </header>

                  <dl className="teacher-compact-details">
                    <div>
                      <dt>{t("common.subject")}</dt>
                      <dd>{(teacher.subjects || []).map(subjectName).join(", ") || "-"}</dd>
                    </div>
                    <div>
                      <dt>{t("common.level")}</dt>
                      <dd>{(teacher.class_levels || []).map(className).join(", ") || "-"}</dd>
                    </div>
                    <div>
                      <dt>{t("common.phone")}</dt>
                      <dd dir="ltr">{teacher.phone || "-"}</dd>
                    </div>
                  </dl>

                  <div className="teacher-compact-actions">
                    <Link className="secondary-btn button-link" to={`/schedules?teacher_id=${teacher.id}`}>{t("schedules.viewSchedule")}</Link>
                    <button type="button" className="secondary-btn" onClick={() => openModal(teacher)}>{t("common.edit")}</button>
                    <button type="button" className="danger-btn" onClick={() => removeTeacher(teacher)}>{t("common.delete")}</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="panel teacher-directory-empty"><p className="muted">{t("schedules.noTeacherMatch")}</p></section>
        )}
      </section>

      {modalOpen && (
        <div className="schedule-modal-backdrop" role="presentation">
          <section className="schedule-modal" aria-modal="true" role="dialog">
            <div className="schedule-modal-header">
              <div><p className="brand-kicker">{editingId ? t("common.edit") : t("common.add")}</p><h3>{editingId ? t("schedules.editTeacher") : t("schedules.newTeacher")}</h3></div>
              <button type="button" className="secondary-btn modal-close-btn" onClick={() => setModalOpen(false)}>{t("common.close")}</button>
            </div>
            <form className="form-grid schedule-modal-form" onSubmit={submitTeacher}>
              <label><span>{t("common.lastName")}</span><input value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} required /></label>
              <label><span>{t("common.firstName")}</span><input value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} required /></label>
              <label><span>{t("common.status")}</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="ACTIVE">{t("statuses.active")}</option><option value="INACTIVE">{t("statuses.inactive")}</option></select></label>
              <fieldset className="schedule-radio-group full-field"><legend>{t("schedules.gender")}</legend>
                <label><input type="radio" name="teacher-gender-page" value="MALE" checked={form.gender === "MALE"} onChange={(event) => setForm({ ...form, gender: event.target.value })} required /><span>{t("genders.man")}</span></label>
                <label><input type="radio" name="teacher-gender-page" value="FEMALE" checked={form.gender === "FEMALE"} onChange={(event) => setForm({ ...form, gender: event.target.value })} required /><span>{t("genders.woman")}</span></label>
              </fieldset>
              <label><span>{t("common.phone")}</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></label>
              <label><span>{t("schedules.optionalEmail")}</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label className="full-field"><span>{t("common.address")}</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} required /></label>
              <label className="full-field"><span>{t("schedules.primarySchool")}</span><input value={form.primary_school} onChange={(event) => setForm({ ...form, primary_school: event.target.value })} required /></label>
              <fieldset className="teacher-level-picker full-field"><legend>{t("schedules.taughtLevels")}</legend>
                {classes.map((item) => { const value = String(item.id); return <label key={item.id}><input type="checkbox" checked={form.class_level_ids.includes(value)} onChange={(event) => toggleRelation("class_level_ids", value, event.target.checked)} /><span>{className(item)}</span></label>; })}
                {classes.length === 0 && <p className="muted">{t("schedules.noClassAvailable")}</p>}
              </fieldset>
              <fieldset className="teacher-level-picker full-field"><legend>{t("schedules.taughtSubjects")}</legend>
                {subjects.map((subject) => { const value = String(subject.id); return <label key={subject.id}><input type="checkbox" checked={form.subject_ids.includes(value)} onChange={(event) => toggleRelation("subject_ids", value, event.target.checked)} /><span>{subjectName(subject)}</span></label>; })}
                {subjects.length === 0 && <p className="muted">{t("schedules.noSubjectAvailable")}</p>}
              </fieldset>
              <div className="form-actions full-field"><button type="submit" disabled={saving}>{saving ? t("common.loading") : t("common.save")}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
