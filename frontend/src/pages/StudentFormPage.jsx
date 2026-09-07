import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DEFAULT_LEVEL_OPTIONS } from "../config/schoolOptions";
import { getClassLevels } from "../services/classLevelService";
import { createStudent, getStudentById, updateStudent } from "../services/studentService";
import useI18n from "../hooks/useI18n";

const emptyForm = {
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  address: "",
  class_level_id: "",
  class_name: "",
  school_year: "",
  status: "ACTIVE",
  parent_name: "",
  parent_phone: "",
  monthly_amount: "",
  discount_percent: "0",
};

const formatMoney = (value, language) =>
  new Intl.NumberFormat(language === "ar" ? "ar-MA" : "fr-MA", {
    style: "currency",
    currency: "MAD",
  }).format(Number(value || 0));

export default function StudentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language, t } = useI18n();
  const [form, setForm] = useState(emptyForm);
  const [classLevels, setClassLevels] = useState([]);
  const [pageLoading, setPageLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const editing = Boolean(id);

  useEffect(() => {
    let active = true;

    const loadForm = async () => {
      setPageLoading(editing);
      setError("");

      try {
        const requests = [getClassLevels()];
        if (editing) requests.push(getStudentById(id));
        const [levelData, profileData] = await Promise.all(requests);
        if (!active) return;

        const normalizedLevels = Array.isArray(levelData) ? levelData : [];
        setClassLevels(normalizedLevels);

        if (editing) {
          const student = profileData?.student || profileData;
          const parent = profileData?.parent || {};
          setForm({
            first_name: student?.first_name || "",
            last_name: student?.last_name || "",
            date_of_birth: student?.date_of_birth || "",
            gender: student?.gender || "",
            address: student?.address || "",
            class_level_id: normalizedLevels.length
              ? String(student?.class_level_id || "")
              : String(student?.class_level_name || student?.class_level || ""),
            class_name: student?.class_name || student?.class_group_name || "",
            school_year: student?.school_year || "",
            status: student?.status || "ACTIVE",
            parent_name: student?.parent_name || parent?.name || "",
            parent_phone: parent?.phone || student?.parent_phone || student?.phone || "",
            monthly_amount: student?.monthly_amount != null ? String(student.monthly_amount) : "",
            discount_percent: student?.discount_percent != null ? String(student.discount_percent) : "0",
          });
        }
      } catch (err) {
        setError(editing ? t("studentProfile.loadError") : t("students.loadLevelsError"));
      } finally {
        if (active) setPageLoading(false);
      }
    };

    loadForm();
    return () => {
      active = false;
    };
  }, [editing, id]);

  const levelOptions = useMemo(() => {
    if (classLevels.length) {
      return classLevels.map((item) => ({ id: String(item.id), name: item.name }));
    }

    return DEFAULT_LEVEL_OPTIONS.map((item) => ({ id: item.value, name: t(item.translationKey) }));
  }, [classLevels, t]);

  const effectiveAmount = useMemo(() => {
    const amount = Number(form.monthly_amount || 0);
    const discount = Number(form.discount_percent || 0);
    return Math.max(amount * ((100 - discount) / 100), 0);
  }, [form.discount_percent, form.monthly_amount]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const selectedClassLevelId = classLevels.length ? Number(form.class_level_id) : null;
      if (!form.class_level_id) {
        setError(t("students.chooseLevel"));
        return;
      }

      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        address: form.address.trim() || null,
        class_level_id: selectedClassLevelId || undefined,
        class_level: classLevels.length ? undefined : form.class_level_id,
        class_name: form.class_name.trim() || null,
        school_year: form.school_year.trim() || null,
        status: form.status,
        parent_name: form.parent_name.trim(),
        parent_phone: form.parent_phone.trim(),
        monthly_amount: Number(form.monthly_amount || 0),
        discount_percent: Number(form.discount_percent || 0),
      };

      const result = editing ? await updateStudent(id, payload) : await createStudent(payload);
      navigate(`/students/${result?.id || id}`);
    } catch (err) {
      setError(t("students.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (pageLoading) {
    return <section className="panel student-form-state">{t("common.loading")}</section>;
  }

  return (
    <div className="admin-grid student-form-page">
      <section className="panel hero-modern panel-header student-form-header">
        <div>
          <p className="brand-kicker">{t("students.directoryKicker")}</p>
          <h2>{editing ? t("students.edit") : t("students.create")}</h2>
          <p className="muted">
            {editing ? t("students.editDescription") : t("students.createDescription")}
          </p>
        </div>
        <Link className="secondary-btn button-link" to={editing ? `/students/${id}` : "/students"}>
          {t("students.backToDirectory")}
        </Link>
      </section>

      <form className="student-record-form" onSubmit={handleSubmit}>
        <div className="student-form-layout">
          <section className="panel student-form-section">
            <div className="student-form-section-header">
              <span>01</span>
              <div><h3>{t("students.identitySection")}</h3><p>{t("students.identitySectionHelp")}</p></div>
            </div>
            <div className="student-form-grid">
              <label><span>{t("common.firstName")}</span><input value={form.first_name} onChange={(event) => updateField("first_name", event.target.value)} required /></label>
              <label><span>{t("common.lastName")}</span><input value={form.last_name} onChange={(event) => updateField("last_name", event.target.value)} required /></label>
              <label><span>{t("students.birthDate")}</span><input type="date" value={form.date_of_birth} onChange={(event) => updateField("date_of_birth", event.target.value)} /></label>
              <label><span>{t("students.gender")}</span><select value={form.gender} onChange={(event) => updateField("gender", event.target.value)}><option value="">{t("genders.unspecified")}</option><option value="F">{t("genders.female")}</option><option value="M">{t("genders.male")}</option></select></label>
              <label className="student-form-full-field"><span>{t("common.address")}</span><textarea value={form.address} onChange={(event) => updateField("address", event.target.value)} /></label>
            </div>
          </section>

          <section className="panel student-form-section">
            <div className="student-form-section-header">
              <span>02</span>
              <div><h3>{t("students.schoolingSection")}</h3><p>{t("students.schoolingSectionHelp")}</p></div>
            </div>
            <div className="student-form-grid">
              <label><span>{t("common.level")}</span><select value={form.class_level_id} onChange={(event) => updateField("class_level_id", event.target.value)} required><option value="">{t("students.chooseLevel")}</option>{levelOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span>{t("common.class")}</span><input value={form.class_name} onChange={(event) => updateField("class_name", event.target.value)} placeholder={t("students.classPlaceholder")} /></label>
              <label><span>{t("common.schoolYear")}</span><input value={form.school_year} onChange={(event) => updateField("school_year", event.target.value)} placeholder={t("students.schoolYearPlaceholder")} /></label>
              <label><span>{t("common.status")}</span><select value={form.status} onChange={(event) => updateField("status", event.target.value)}><option value="ACTIVE">{t("statuses.active")}</option><option value="INACTIVE">{t("statuses.inactive")}</option></select></label>
            </div>
          </section>

          <section className="panel student-form-section">
            <div className="student-form-section-header">
              <span>03</span>
              <div><h3>{t("students.familySection")}</h3><p>{t("students.familySectionHelp")}</p></div>
            </div>
            <div className="student-form-grid">
              <label><span>{t("students.parentName")}</span><input value={form.parent_name} onChange={(event) => updateField("parent_name", event.target.value)} required /></label>
              <label><span>{t("students.parentPhone")}</span><input type="tel" dir="ltr" value={form.parent_phone} onChange={(event) => updateField("parent_phone", event.target.value)} required /></label>
            </div>
          </section>

          <section className="panel student-form-section">
            <div className="student-form-section-header">
              <span>04</span>
              <div><h3>{t("students.billingSection")}</h3><p>{t("students.billingSectionHelp")}</p></div>
            </div>
            <div className="student-form-grid">
              <label><span>{t("students.monthlyAmount")}</span><input type="number" min="0" step="0.01" value={form.monthly_amount} onChange={(event) => updateField("monthly_amount", event.target.value)} required /></label>
              <label><span>{t("students.discount")}</span><input type="number" min="0" max="100" step="0.01" value={form.discount_percent} onChange={(event) => updateField("discount_percent", event.target.value)} /></label>
              <div className="student-net-fee student-form-full-field"><span>{t("students.netMonthlyFee")}</span><strong>{formatMoney(effectiveAmount, language)}</strong><small>{t("students.netMonthlyFeeHelp")}</small></div>
            </div>
          </section>
        </div>

        <section className="panel student-form-footer">
          <div>
            <strong>{t("students.formReadyTitle")}</strong>
            <p className="muted">{t("students.formReadyHelp")}</p>
            {error && <p className="error-text student-feedback">{error}</p>}
          </div>
          <div className="student-form-actions">
            <Link className="secondary-btn button-link" to={editing ? `/students/${id}` : "/students"}>{t("common.cancel")}</Link>
            <button type="submit" disabled={saving}>{saving ? t("common.saving") : (editing ? t("common.save") : t("students.createAction"))}</button>
          </div>
        </section>
      </form>
    </div>
  );
}
