import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSchoolById, updateSchool } from "../services/schoolService";

export default function SchoolDetailsPage() {
  const { id } = useParams();
  const [school, setSchool] = useState(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    const data = await getSchoolById(id);
    setSchool(data);
  };

  useEffect(() => {
    load().catch(() => null);
  }, [id]);

  const handleToggle = async () => {
    if (!school) return;
    const nextStatus = school.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await updateSchool(id, { status: nextStatus });
    setMessage(`Statut de l'ecole mis a jour: ${nextStatus === "ACTIVE" ? "Actif" : "Inactif"}`);
    await load();
  };

  if (!school) {
    return <section className="panel">Chargement...</section>;
  }

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">Details ecole</p>
        <h2>{school.name}</h2>
        <p className="muted">Code: {school.code} | Domaine: {school.email_domain}</p>
      </section>

      <section className="panel">
        <button type="button" onClick={handleToggle}>Activer / desactiver</button>
        <Link to={`/super-admin/schools/${school.id}/admin`} style={{ marginLeft: 12 }}>Creer l'admin principal</Link>
        {message && <p className="muted">{message}</p>}
      </section>
    </div>
  );
}
