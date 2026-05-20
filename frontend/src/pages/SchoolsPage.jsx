import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createUser } from "../services/userService";
import {
  createSchool,
  getSchools,
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
  const [schools, setSchools] = useState([]);
  const [schoolForm, setSchoolForm] = useState(EMPTY_SCHOOL_FORM);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSchool = useMemo(
    () => schools.find((item) => String(item.id) === String(userForm.school_id)) || null,
    [schools, userForm.school_id]
  );

  const emailDomain = selectedSchool?.email_domain || "school-domain.com";

  const loadSchools = async () => {
    const data = await getSchools();
    const safe = Array.isArray(data) ? data : [];
    setSchools(safe);

    if (!userForm.school_id && safe.length > 0) {
      setUserForm((prev) => ({ ...prev, school_id: String(safe[0].id) }));
    }
  };

  useEffect(() => {
    loadSchools().catch(() => setError("Impossible de charger les ecoles."));
  }, []);

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      let logo_path = "";
      if (logoFile) {
        const upload = await uploadSchoolLogo(logoFile);
        logo_path = upload.logo_path || "";
      }

      const created = await createSchool({ ...schoolForm, logo_path });
      setMessage(`Ecole creee: ${created.name}`);
      setSchoolForm(EMPTY_SCHOOL_FORM);
      setLogoFile(null);
      await loadSchools();
      setUserForm((prev) => ({ ...prev, school_id: String(created.id) }));
    } catch (err) {
      setError(err?.response?.data?.message || "Echec de creation de l'ecole.");
    }
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
      setMessage(`Utilisateur cree: ${created.email}`);
      setUserForm((prev) => ({ ...EMPTY_USER_FORM, school_id: prev.school_id, role: prev.role }));
    } catch (err) {
      setError(err?.response?.data?.message || "Echec de creation utilisateur.");
    }
  };

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">Gestion des ecoles</p>
        <h2>Configuration des etablissements et des acces</h2>
        <p className="muted">Creez une ecole puis rattachez les utilisateurs et leurs roles.</p>
      </section>

      <section className="panel">
        <h3>Etape 1: Creer une ecole</h3>
        <form className="form-grid" onSubmit={handleCreateSchool}>
          <input placeholder="Nom de l'ecole" value={schoolForm.name} onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })} required />
          <input placeholder="Code ecole" value={schoolForm.code} onChange={(e) => setSchoolForm({ ...schoolForm, code: e.target.value })} required />
          <input placeholder="Slug (optionnel)" value={schoolForm.slug} onChange={(e) => setSchoolForm({ ...schoolForm, slug: e.target.value })} />
          <input placeholder="Domaine email" value={schoolForm.email_domain} onChange={(e) => setSchoolForm({ ...schoolForm, email_domain: e.target.value })} required />
          <input placeholder="Telephone" value={schoolForm.phone} onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })} />
          <input placeholder="Adresse" value={schoolForm.address} onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })} />
          <input placeholder="Ville" value={schoolForm.city} onChange={(e) => setSchoolForm({ ...schoolForm, city: e.target.value })} />
          <input placeholder="Pays" value={schoolForm.country} onChange={(e) => setSchoolForm({ ...schoolForm, country: e.target.value })} />
          <select value={schoolForm.status} onChange={(e) => setSchoolForm({ ...schoolForm, status: e.target.value })}>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
          </select>
          <input type="file" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
          <button type="submit">Creer l'ecole</button>
        </form>
      </section>

      <section className="panel">
        <h3>Etape 2: Creer un utilisateur</h3>
        <form className="form-grid" onSubmit={handleCreateUser}>
          <select value={userForm.school_id} onChange={(e) => setUserForm({ ...userForm, school_id: e.target.value })} required>
            <option value="" disabled>Selectionner une ecole</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name} ({school.email_domain})</option>
            ))}
          </select>

          <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
            <option value="admin">Admin</option>
            <option value="user">Utilisateur</option>
          </select>

          <input placeholder="Prenom" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} required />
          <input placeholder="Nom" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} required />
          <input placeholder="Prefixe email (ex: salma.alaoui)" value={userForm.email_local_part} onChange={(e) => setUserForm({ ...userForm, email_local_part: e.target.value })} />
          <p className="muted">Apercu email: {(userForm.email_local_part || "prenom.nom") + "@" + emailDomain}</p>
          <input type="password" placeholder="Mot de passe" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
          <select value={userForm.status} onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
          </select>

          <button type="submit">Creer l'utilisateur</button>
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
        <h3>Liste des ecoles</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Nom</th><th>Code</th><th>Domaine</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id}>
                  <td>{school.id}</td>
                  <td>{school.name}</td>
                  <td>{school.code}</td>
                  <td>{school.email_domain}</td>
                  <td>{school.status === "ACTIVE" ? "Actif" : "Inactif"}</td>
                  <td><Link to={`/super-admin/schools/${school.id}`}>Detail</Link></td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr>
                  <td colSpan="6" className="table-empty">Aucune ecole trouvee.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
