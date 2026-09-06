import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSchoolById, updateSchool, uploadSchoolLogo, importSchoolData } from "../services/schoolService";
import useI18n from "../hooks/useI18n";
import { STUDENT_IMPORT_HEADERS } from "../config/schoolOptions";
const isValidImportFile = (file) => /\.(xlsx|xls|csv)$/i.test(file?.name || "");

export default function SchoolDetailsPage() {
  const { id } = useParams();
  const { language, t } = useI18n();
  const [school, setSchool] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [schoolDataFile, setSchoolDataFile] = useState(null);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const templateHref = useMemo(
    () => `data:text/csv;charset=utf-8,${encodeURIComponent(`${STUDENT_IMPORT_HEADERS.join(";")}\n`)}`,
    []
  );

  const load = async () => {
    try {
      const data = await getSchoolById(id);
      setSchool(data);
      setFormData(data || {});
      setError("");
    } catch (err) {
      setError(t("schools.loadError"));
      setSchool(null);
    }
  };

  useEffect(() => {
    load();
  }, [id, t]);

  const handleToggle = async () => {
    if (!school) return;
    const nextStatus = school.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateSchool(id, { status: nextStatus });
      setMessage(t("schools.statusUpdated", { status: nextStatus === "ACTIVE" ? t("statuses.active") : t("statuses.inactive") }));
      await load();
    } catch (err) {
      setError(t("schools.statusUpdateError"));
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      let logo_path = formData.logo_path || school.logo_path;
      
      if (logoFile) {
        const upload = await uploadSchoolLogo(logoFile);
        logo_path = upload.logo_path || logo_path;
      }

      const updatePayload = {
        name: formData.name,
        code: formData.code,
        slug: formData.slug || undefined,
        email_domain: formData.email_domain,
        logo_path,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        country: formData.country || undefined,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
        currency: formData.currency,
        status: formData.status,
      };

      await updateSchool(id, updatePayload);
      setMessage(t("schools.updateSuccess"));
      setIsEditing(false);
      setLogoFile(null);
      await load();
    } catch (err) {
      setError(t("schools.updateError"));
    }
  };

  const handleSchoolDataFile = (file) => {
    setError("");
    if (!file) {
      setSchoolDataFile(null);
      return;
    }

    if (!isValidImportFile(file)) {
      setSchoolDataFile(null);
      setError(t("schools.invalidFile"));
      return;
    }

    setSchoolDataFile(file);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setImportProgress(0);

    if (!schoolDataFile) {
      setError(t("schools.studentImportRequired"));
      return;
    }

    try {
      setIsImporting(true);
      const imported = await importSchoolData(id, schoolDataFile, setImportProgress);
      setMessage(t("schools.importComplete"));
      setSchoolDataFile(null);
      setImportProgress(100);
    } catch (err) {
      setError(t("schools.importError"));
    } finally {
      setIsImporting(false);
    }
  };

  if (!school) {
    return <section className="panel">{t("common.loading")}</section>;
  }

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">{t("schools.details")}</p>
        <h2>{school.name}</h2>
        <p className="muted">{t("schools.codeAndDomain", { code: school.code, domain: school.email_domain })}</p>
      </section>

      {!isEditing && (
        <section className="panel">
          <button type="button" onClick={() => setIsEditing(true)}>{t("common.edit")}</button>
          <button type="button" onClick={handleToggle} style={{ marginLeft: 12 }}>{t("schools.toggleStatus")}</button>
          <Link to={`/super-admin/schools/${school.id}/admin`} style={{ marginLeft: 12 }}>{t("schools.createMainAdmin")}</Link>
          {message && <p className="muted">{message}</p>}
          {error && <p className="error-text">{error}</p>}
        </section>
      )}

      {isEditing && (
        <section className="panel">
          <h3>{t("schools.editSchool")}</h3>
          <form className="form-grid" onSubmit={handleEditSubmit}>
            <input
              placeholder={t("schools.schoolName")}
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <input
              placeholder={t("schools.schoolCode")}
              value={formData.code || ""}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
            <input
              placeholder={t("schools.optionalSlug")}
              value={formData.slug || ""}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            />
            <input
              placeholder={t("schools.emailDomain")}
              value={formData.email_domain || ""}
              onChange={(e) => setFormData({ ...formData, email_domain: e.target.value })}
              required
            />
            <input
              placeholder={t("common.phone")}
              value={formData.phone || ""}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <input
              placeholder={t("common.address")}
              value={formData.address || ""}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
            <input
              placeholder={t("schools.city")}
              value={formData.city || ""}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
            <input
              placeholder={t("schools.country")}
              value={formData.country || ""}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            />
            <div>
              <label>{t("schools.primaryColor")}</label>
              <input
                type="color"
                value={formData.primary_color || "#1E3A8A"}
                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
              />
            </div>
            <div>
              <label>{t("schools.secondaryColor")}</label>
              <input
                type="color"
                value={formData.secondary_color || "#22C55E"}
                onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
              />
            </div>
            <input
              placeholder={t("schools.currency")}
              value={formData.currency || "MAD"}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
            />
            <select
              value={formData.status || "ACTIVE"}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="ACTIVE">{t("statuses.active")}</option>
              <option value="INACTIVE">{t("statuses.inactive")}</option>
            </select>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.webp"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            />
            {logoFile && <p className="muted">{t("schools.selectedLogo", { name: logoFile.name })}</p>}
            
            <div style={{ display: "flex", gap: "12px", gridColumn: "1/-1" }}>
              <button type="submit">{t("schools.saveChanges")}</button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setFormData(school);
                  setLogoFile(null);
                  setError("");
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
            
            {message && <p className="muted" style={{ gridColumn: "1/-1" }}>{message}</p>}
            {error && <p className="error-text" style={{ gridColumn: "1/-1" }}>{error}</p>}
          </form>
        </section>
      )}

      {!isEditing && (
        <section className="panel">
          <h3>{t("schools.importStudents")}</h3>
          <form className="form-grid" onSubmit={handleImportSubmit}>
            <div
              className={`upload-dropzone ${isDragging ? "upload-dropzone-active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleSchoolDataFile(e.dataTransfer.files?.[0] || null);
              }}
            >
              <div>
                <p className="kpi-label">{t("schools.importStudentsData")}</p>
                <p className="muted">{t("schools.importHelp")}</p>
                {schoolDataFile && <p className="muted">{t("schools.selectedFile", { name: schoolDataFile.name })}</p>}
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleSchoolDataFile(e.target.files?.[0] || null)}
              />
            </div>
            <a className="text-link" href={templateHref} download={t("schools.studentsTemplateFilename")}>
              {t("schools.downloadTemplate")}
            </a>
            {isImporting && (
              <div className="progress-wrap">
                <div className="progress-bar" style={{ width: `${importProgress || 12}%` }} />
              </div>
            )}
            <button type="submit" disabled={isImporting} style={{ gridColumn: "1/-1" }}>
              {isImporting ? t("schools.importing") : t("schools.importStudentsAction")}
            </button>
            {message && <p className="muted" style={{ gridColumn: "1/-1" }}>{message}</p>}
            {error && <p className="error-text" style={{ gridColumn: "1/-1" }}>{error}</p>}
          </form>
        </section>
      )}

      {!isEditing && (
        <section className="panel">
          <h3>{t("schools.studentsLink")}</h3>
          <p className="muted">{t("schools.studentsLinkHelp")}</p>
          <Link to="/students" style={{ marginTop: "12px", display: "inline-block" }}>
            {t("schools.viewStudents")}
          </Link>
        </section>
      )}

      {!isEditing && (
        <section className="panel">
          <h3>{t("schools.information")}</h3>
          <div style={{ display: "grid", gap: "12px" }}>
            <div><strong>{t("schools.schoolCode")}:</strong> {school.code}</div>
            <div><strong>{t("schools.optionalSlug")}:</strong> {school.slug || "-"}</div>
            <div><strong>{t("schools.emailDomain")}:</strong> {school.email_domain}</div>
            <div><strong>{t("common.phone")}:</strong> {school.phone || "-"}</div>
            <div><strong>{t("common.address")}:</strong> {school.address || "-"}</div>
            <div><strong>{t("schools.city")}:</strong> {school.city || "-"}</div>
            <div><strong>{t("schools.country")}:</strong> {school.country || "-"}</div>
            <div><strong>{t("schools.currency")}:</strong> {school.currency}</div>
            <div><strong>{t("schools.primaryColor")}:</strong> <span style={{ display: "inline-block", width: "20px", height: "20px", backgroundColor: school.primary_color, border: "1px solid #ccc", verticalAlign: "middle", marginLeft: "8px" }} /></div>
            <div><strong>{t("schools.secondaryColor")}:</strong> <span style={{ display: "inline-block", width: "20px", height: "20px", backgroundColor: school.secondary_color, border: "1px solid #ccc", verticalAlign: "middle", marginLeft: "8px" }} /></div>
            <div><strong>{t("common.status")}:</strong> {school.status === "ACTIVE" ? t("statuses.active") : t("statuses.inactive")}</div>
            <div><strong>{t("schools.createdAt")}:</strong> {new Date(school.created_at).toLocaleDateString(language === "ar" ? "ar-MA" : "fr-FR")}</div>
          </div>
        </section>
      )}
    </div>
  );
}
