import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createUser } from "../services/userService";
import useI18n from "../hooks/useI18n";
import { STUDENT_IMPORT_HEADERS } from "../config/schoolOptions";
import {
  createSchool,
  deleteSchool,
  getSchools,
  importSchoolData,
  updateSchool,
  uploadSchoolLogo,
} from "../services/schoolService";

const EMPTY_SCHOOL_FORM = {
  name: "",
  code: "",
  slug: "",
  email_domain: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  primary_color: "#1E3A8A",
  secondary_color: "#22C55E",
  currency: "MAD",
  status: "ACTIVE",
};

const isValidImportFile = (file) => /\.(xlsx|xls|csv)$/i.test(file?.name || "");

const EMPTY_USER_FORM = {
  first_name: "",
  last_name: "",
  email_local_part: "",
  password: "",
  role: "admin",
  school_id: "",
  status: "ACTIVE",
};

export default function SchoolsPage() {
  const { t } = useI18n();
  const [schools, setSchools] = useState([]);
  const [schoolForm, setSchoolForm] = useState(EMPTY_SCHOOL_FORM);
  const [editingSchoolId, setEditingSchoolId] = useState(null);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [schoolDataFile, setSchoolDataFile] = useState(null);
  const [importProgress, setImportProgress] = useState(0);
  const [creatingSchool, setCreatingSchool] = useState(false);
  const [isDraggingImport, setIsDraggingImport] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSchool = useMemo(
    () => schools.find((item) => String(item.id) === String(userForm.school_id)) || null,
    [schools, userForm.school_id]
  );

  const emailDomain = selectedSchool?.email_domain || "school-domain.com";
  const isEditingSchool = editingSchoolId !== null;
  const templateHref = useMemo(
    () => `data:text/csv;charset=utf-8,${encodeURIComponent(`${STUDENT_IMPORT_HEADERS.join(";")}\n`)}`,
    []
  );

  const loadSchools = async () => {
    const data = await getSchools();
    const safe = Array.isArray(data) ? data : [];
    setSchools(safe);

    if (!userForm.school_id && safe.length > 0) {
      setUserForm((prev) => ({ ...prev, school_id: String(safe[0].id) }));
    }
  };

  useEffect(() => {
    loadSchools().catch(() => setError(t("schools.loadError")));
  }, [t]);

  const resetSchoolForm = () => {
    setEditingSchoolId(null);
    setSchoolForm(EMPTY_SCHOOL_FORM);
    setLogoFile(null);
    setSchoolDataFile(null);
    setImportProgress(0);
  };

  const handleSaveSchool = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setImportProgress(0);

    if (!isEditingSchool && !schoolDataFile) {
      setError(t("schools.importRequired"));
      return;
    }

    if (schoolDataFile && !isValidImportFile(schoolDataFile)) {
      setError(t("schools.invalidFile"));
      return;
    }

    try {
      setCreatingSchool(true);
      let logo_path = "";
      if (logoFile) {
        const upload = await uploadSchoolLogo(logoFile);
        logo_path = upload.logo_path || "";
      }

      if (isEditingSchool) {
        const updated = await updateSchool(editingSchoolId, {
          ...schoolForm,
          ...(logo_path ? { logo_path } : {}),
        });
        setMessage(t("schools.updatedNamed", { name: updated.name || schoolForm.name }));
      } else {
        const created = await createSchool({ ...schoolForm, logo_path });
        const imported = await importSchoolData(created.id, schoolDataFile, setImportProgress);
        setMessage(t("schools.createdNamed", { name: created.name, result: t("schools.importComplete") }));
        setUserForm((prev) => ({ ...prev, school_id: String(created.id) }));
      }

      resetSchoolForm();
      setImportProgress(isEditingSchool ? 0 : 100);
      await loadSchools();
    } catch (err) {
      setError(t("schools.saveError"));
    } finally {
      setCreatingSchool(false);
    }
  };

  const handleEditSchool = (school) => {
    setEditingSchoolId(school.id);
    setSchoolForm({
      name: school.name || "",
      code: school.code || "",
      slug: school.slug || "",
      email_domain: school.email_domain || "",
      phone: school.phone || "",
      address: school.address || "",
      city: school.city || "",
      country: school.country || "",
      primary_color: school.primary_color || "#1E3A8A",
      secondary_color: school.secondary_color || "#22C55E",
      currency: school.currency || "MAD",
      status: school.status || "ACTIVE",
    });
    setLogoFile(null);
    setSchoolDataFile(null);
    setImportProgress(0);
    setMessage("");
    setError("");
  };

  const handleDeleteSchool = async (school) => {
    if (!window.confirm(t("schools.confirmDelete", { name: school.name }))) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await deleteSchool(school.id);
      setMessage(t("schools.deleted"));
      if (editingSchoolId === school.id) {
        resetSchoolForm();
      }
      await loadSchools();
    } catch (err) {
      setError(t("schools.deleteError"));
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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const payload = {
        first_name: userForm.first_name,
        last_name: userForm.last_name,
        email_local_part: userForm.email_local_part,
        password: userForm.password,
        role: userForm.role,
        school_id: Number(userForm.school_id),
        status: userForm.status,
      };

      const created = await createUser(payload);
      setMessage(t("schools.userCreated", { email: created.email }));
      setUserForm((prev) => ({ ...EMPTY_USER_FORM, school_id: prev.school_id, role: prev.role }));
    } catch (err) {
      setError(t("schools.userCreateError"));
    }
  };

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">{t("schools.management")}</p>
        <h2>{t("schools.configuration")}</h2>
        <p className="muted">{t("schools.configurationHelp")}</p>
      </section>

      <section className="panel">
        <h3>{isEditingSchool ? t("schools.editSchool") : t("schools.createStep")}</h3>
        <form className="form-grid" onSubmit={handleSaveSchool}>
          <input placeholder={t("schools.schoolName")} value={schoolForm.name} onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })} required />
          <input placeholder={t("schools.schoolCode")} value={schoolForm.code} onChange={(e) => setSchoolForm({ ...schoolForm, code: e.target.value })} required />
          <input placeholder={t("schools.optionalSlug")} value={schoolForm.slug} onChange={(e) => setSchoolForm({ ...schoolForm, slug: e.target.value })} />
          <input placeholder={t("schools.emailDomain")} value={schoolForm.email_domain} onChange={(e) => setSchoolForm({ ...schoolForm, email_domain: e.target.value })} required />
          <input placeholder={t("common.phone")} value={schoolForm.phone} onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })} />
          <input placeholder={t("common.address")} value={schoolForm.address} onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })} />
          <input placeholder={t("schools.city")} value={schoolForm.city} onChange={(e) => setSchoolForm({ ...schoolForm, city: e.target.value })} />
          <input placeholder={t("schools.country")} value={schoolForm.country} onChange={(e) => setSchoolForm({ ...schoolForm, country: e.target.value })} />
          <select value={schoolForm.status} onChange={(e) => setSchoolForm({ ...schoolForm, status: e.target.value })}>
            <option value="ACTIVE">{t("statuses.active")}</option>
            <option value="INACTIVE">{t("statuses.inactive")}</option>
          </select>
          <input type="file" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
          <div
            className={`upload-dropzone ${isDraggingImport ? "upload-dropzone-active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingImport(true);
            }}
            onDragLeave={() => setIsDraggingImport(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingImport(false);
              handleSchoolDataFile(e.dataTransfer.files?.[0] || null);
            }}
          >
            <div>
              <p className="kpi-label">{t("schools.importData")}</p>
              <p className="muted">{t("schools.importHelp")}</p>
              {schoolDataFile && <p className="muted">{t("schools.selectedFile", { name: schoolDataFile.name })}</p>}
              {isEditingSchool && <p className="muted">{t("schools.optionalOnEdit")}</p>}
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleSchoolDataFile(e.target.files?.[0] || null)}
              required={!isEditingSchool}
            />
          </div>
          <a className="text-link" href={templateHref} download={t("schools.schoolTemplateFilename")}>
            {t("schools.downloadTemplate")}
          </a>
          {creatingSchool && (
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${importProgress || 12}%` }} />
            </div>
          )}
          <div className="form-actions">
            <button type="submit" disabled={creatingSchool}>
              {creatingSchool
                ? isEditingSchool ? t("schools.updating") : t("schools.creatingAndImporting")
                : isEditingSchool ? t("common.save") : t("schools.createAndImport")}
            </button>
            {isEditingSchool && (
              <button type="button" className="secondary-btn" onClick={resetSchoolForm}>
                {t("common.cancel")}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <h3>{t("schools.createUserStep")}</h3>
        <form className="form-grid" onSubmit={handleCreateUser}>
          <select value={userForm.school_id} onChange={(e) => setUserForm({ ...userForm, school_id: e.target.value })} required>
            <option value="" disabled>{t("schools.selectSchool")}</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name} ({school.email_domain})</option>
            ))}
          </select>

          <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
            <option value="admin">{t("roles.admin")}</option>
            <option value="user">{t("roles.user")}</option>
          </select>

          <input placeholder={t("common.firstName")} value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} required />
          <input placeholder={t("common.lastName")} value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} required />
          <input placeholder={t("schools.emailPrefix")} value={userForm.email_local_part} onChange={(e) => setUserForm({ ...userForm, email_local_part: e.target.value })} />
          <p className="muted">{t("schools.emailPreview", { email: `${userForm.email_local_part || "prenom.nom"}@${emailDomain}` })}</p>
          <input type="password" placeholder={t("common.password")} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
          <select value={userForm.status} onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}>
            <option value="ACTIVE">{t("statuses.active")}</option>
            <option value="INACTIVE">{t("statuses.inactive")}</option>
          </select>

          <button type="submit">{t("schools.createUser")}</button>
        </form>
      </section>

      {message && (
        <section className="panel">
          <p className="muted">{message}</p>
        </section>
      )}

      {error && (
        <section className="panel">
          <p className="error-text">{error}</p>
        </section>
      )}

      <section className="panel">
        <h3>{t("schools.list")}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{t("common.id")}</th><th>{t("common.name")}</th><th>{t("schools.schoolCode")}</th><th>{t("schools.domain")}</th><th>{t("common.status")}</th><th>{t("common.actions")}</th></tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id}>
                  <td>{school.id}</td>
                  <td>{school.name}</td>
                  <td>{school.code}</td>
                  <td>{school.email_domain}</td>
                  <td>{school.status === "ACTIVE" ? t("statuses.active") : t("statuses.inactive")}</td>
                  <td>
                    <div className="table-actions">
                      <Link className="text-link" to={`/super-admin/schools/${school.id}`}>{t("schools.detailsAction")}</Link>
                      <button type="button" className="secondary-btn" onClick={() => handleEditSchool(school)}>
                        {t("common.edit")}
                      </button>
                      <button type="button" className="danger-btn" onClick={() => handleDeleteSchool(school)}>
                        {t("common.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr>
                  <td colSpan="6" className="table-empty">{t("schools.empty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
