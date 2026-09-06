import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DEFAULT_LEVEL_OPTIONS } from "../config/schoolOptions";
import { getClassLevels } from "../services/classLevelService";
import { deleteStudent, getStudents } from "../services/studentService";
import useAuth from "../hooks/useAuth";
import useI18n from "../hooks/useI18n";

const emptyFilters = {
  last_name: "",
  first_name: "",
  class_level: "",
  class_name: "",
};

const formatMoney = (value, language) =>
  new Intl.NumberFormat(language === "ar" ? "ar-MA" : "fr-MA", {
    style: "currency",
    currency: "MAD",
  }).format(Number(value || 0));

export default function StudentsPage() {
  const { user } = useAuth();
  const { language, t } = useI18n();
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [classLevels, setClassLevels] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canManageStudents = user?.role === "admin";

  useEffect(() => {
    let active = true;

    const loadDirectory = async () => {
      setLoading(true);
      setError("");

      try {
        const [studentResult, levelResult] = await Promise.allSettled([getStudents(), getClassLevels()]);
        if (!active) return;
        if (studentResult.status !== "fulfilled") throw studentResult.reason;

        const normalizedStudents = Array.isArray(studentResult.value) ? studentResult.value : [];
        setStudents(normalizedStudents);
        setAllStudents(normalizedStudents);
        if (levelResult.status === "fulfilled") {
          setClassLevels(Array.isArray(levelResult.value) ? levelResult.value : []);
        } else {
          setClassLevels([]);
          setError(t("students.loadLevelsError"));
        }
      } catch (err) {
        if (active) setError(t("students.searchError"));
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDirectory();
    return () => {
      active = false;
    };
  }, []);

  const levelOptions = useMemo(() => {
    if (classLevels.length) {
      return classLevels.map((item) => ({ id: item.id, name: item.name }));
    }

    return DEFAULT_LEVEL_OPTIONS.map((item) => ({ id: item.value, name: t(item.translationKey) }));
  }, [classLevels, t]);

  const directoryStats = useMemo(() => {
    const total = allStudents.length;
    const active = allStudents.filter((student) => student.status !== "INACTIVE").length;
    const inactive = total - active;
    const totalMonthlyFees = allStudents.reduce(
      (sum, student) => sum + Number(student.monthly_amount || 0),
      0
    );

    return {
      total,
      active,
      inactive,
      averageFee: total ? totalMonthlyFees / total : 0,
    };
  }, [allStudents]);

  const buildFilterParams = (currentFilters) => ({
    last_name: currentFilters.last_name || undefined,
    first_name: currentFilters.first_name || undefined,
    class_level: currentFilters.class_level || undefined,
    class_name: currentFilters.class_name || undefined,
  });

  const applyStudentFilters = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const data = await getStudents(buildFilterParams(filters));
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      setStudents([]);
      setError(t("students.searchError"));
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setStudents(allStudents);
    setError("");
    setMessage("");
  };

  const handleDelete = async (student) => {
    const fullName = `${student.first_name} ${student.last_name}`.trim();
    if (!window.confirm(t("students.confirmDelete", { name: fullName }))) return;

    setDeletingId(student.id);
    setError("");
    setMessage("");

    try {
      await deleteStudent(student.id);
      const refreshedStudents = await getStudents();
      const normalizedStudents = Array.isArray(refreshedStudents) ? refreshedStudents : [];
      setAllStudents(normalizedStudents);

      const hasFilters = Object.values(filters).some((value) => String(value || "").trim() !== "");
      if (hasFilters) {
        const filteredData = await getStudents(buildFilterParams(filters));
        setStudents(Array.isArray(filteredData) ? filteredData : []);
      } else {
        setStudents(normalizedStudents);
      }

      setMessage(t("students.deleted"));
    } catch (err) {
      setError(t("students.deleteError"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-grid student-directory-page">
      <section className="panel hero-modern panel-header student-directory-header">
        <div>
          <p className="brand-kicker">{t("students.directoryKicker")}</p>
          <h2>{t("students.directoryTitle")}</h2>
          <p className="muted">{t("students.directoryDescription")}</p>
        </div>
        {canManageStudents && (
          <Link className="button-link student-add-button" to="/students/new">
            <span aria-hidden="true">+</span>
            {t("students.create")}
          </Link>
        )}
      </section>

      <section className="student-directory-kpis" aria-label={t("students.directoryOverview")}>
        <article className="panel student-directory-kpi">
          <span className="student-kpi-icon student-kpi-icon-blue" aria-hidden="true">01</span>
          <div><p>{t("students.totalStudents")}</p><strong>{directoryStats.total}</strong></div>
        </article>
        <article className="panel student-directory-kpi">
          <span className="student-kpi-icon student-kpi-icon-green" aria-hidden="true">02</span>
          <div><p>{t("students.activeStudents")}</p><strong>{directoryStats.active}</strong></div>
        </article>
        <article className="panel student-directory-kpi">
          <span className="student-kpi-icon student-kpi-icon-slate" aria-hidden="true">03</span>
          <div><p>{t("students.inactiveStudents")}</p><strong>{directoryStats.inactive}</strong></div>
        </article>
        <article className="panel student-directory-kpi">
          <span className="student-kpi-icon student-kpi-icon-teal" aria-hidden="true">04</span>
          <div><p>{t("students.averageFee")}</p><strong>{formatMoney(directoryStats.averageFee, language)}</strong></div>
        </article>
      </section>

      <section className="panel student-directory-panel">
        <div className="student-section-heading">
          <div>
            <h3>{t("students.list")}</h3>
            <p className="muted">{t("students.listDescription")}</p>
          </div>
          <span className="student-results-count">
            {t("students.resultsCount", { count: students.length })}
          </span>
        </div>

        <form className="student-list-filters" onSubmit={applyStudentFilters}>
          <div className="student-filter-fields">
            <label>
              <span>{t("common.lastName")}</span>
              <input
                placeholder={t("students.filterLastName")}
                value={filters.last_name}
                onChange={(event) => setFilters({ ...filters, last_name: event.target.value })}
              />
            </label>
            <label>
              <span>{t("common.firstName")}</span>
              <input
                placeholder={t("students.filterFirstName")}
                value={filters.first_name}
                onChange={(event) => setFilters({ ...filters, first_name: event.target.value })}
              />
            </label>
            <label>
              <span>{t("common.level")}</span>
              <select
                value={filters.class_level}
                onChange={(event) => setFilters({ ...filters, class_level: event.target.value })}
              >
                <option value="">{t("students.allLevels")}</option>
                {levelOptions.map((item) => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("common.class")}</span>
              <input
                placeholder={t("students.filterClass")}
                value={filters.class_name}
                onChange={(event) => setFilters({ ...filters, class_name: event.target.value })}
              />
            </label>
          </div>
          <div className="student-filter-actions">
            <button type="button" className="secondary-btn" onClick={resetFilters}>
              {t("common.reset")}
            </button>
            <button type="submit" disabled={loading}>
              {loading ? t("common.searching") : t("common.search")}
            </button>
          </div>
        </form>

        {message && <p className="success-text student-feedback">{message}</p>}
        {error && <p className="error-text student-feedback">{error}</p>}

        <div className="table-wrap student-table-wrap">
          <table className="student-list-table">
            <thead>
              <tr>
                <th>{t("common.student")}</th>
                <th>{t("students.schooling")}</th>
                <th>{t("common.parent")}</th>
                <th>{t("students.monthlyFee")}</th>
                <th>{t("common.status")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
                const classSummary = [student.class_name || student.class_group_name, student.school_year]
                  .filter(Boolean)
                  .join(" · ");
                const parentPhone = student.parent_phone || student.phone || "-";

                return (
                  <tr key={student.id}>
                    <td data-label={t("common.student")}>
                      <div className="student-identity-cell">
                        <span className="student-initials" aria-hidden="true">
                          {(student.first_name?.[0] || "") + (student.last_name?.[0] || "")}
                        </span>
                        <div className="student-cell-stack">
                          <Link className="student-name-link" to={`/students/${student.id}`}>{fullName}</Link>
                          <span>#{student.id}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label={t("students.schooling")}>
                      <div className="student-cell-stack">
                        <strong>{student.class_level_name || student.class_level || "-"}</strong>
                        <span>{classSummary || "-"}</span>
                      </div>
                    </td>
                    <td data-label={t("common.parent")}>
                      <div className="student-cell-stack">
                        <strong>{student.parent_name || "-"}</strong>
                        <span dir="ltr">{parentPhone}</span>
                      </div>
                    </td>
                    <td data-label={t("students.monthlyFee")}>
                      <div className="student-cell-stack">
                        <strong>{formatMoney(student.monthly_amount, language)}</strong>
                        <span>{t("students.discountValue", { value: Number(student.discount_percent || 0) })}</span>
                      </div>
                    </td>
                    <td data-label={t("common.status")}>
                      <span className={`student-status-badge ${student.status === "INACTIVE" ? "is-inactive" : "is-active"}`}>
                        {student.status === "INACTIVE" ? t("statuses.inactive") : t("statuses.active")}
                      </span>
                    </td>
                    <td data-label={t("common.actions")}>
                      <div className="student-row-actions">
                        <Link className="secondary-btn button-link" to={`/students/${student.id}`}>
                          {t("common.details")}
                        </Link>
                        {canManageStudents && (
                          <>
                            <Link className="student-action-link" to={`/students/${student.id}/edit`}>
                              {t("common.edit")}
                            </Link>
                            <button
                              type="button"
                              className="student-action-danger"
                              disabled={deletingId === student.id}
                              onClick={() => handleDelete(student)}
                            >
                              {deletingId === student.id ? t("common.loading") : t("common.delete")}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && students.length === 0 && (
                <tr><td colSpan="6" className="table-empty">{t("students.emptyDirectory")}</td></tr>
              )}
              {loading && students.length === 0 && (
                <tr><td colSpan="6" className="table-empty">{t("common.loading")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
