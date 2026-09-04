import { Navigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

export default function RoleRoute({ roles, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!roles.includes(user.role)) {
    return <section className="panel"><h2>403 — Accès non autorisé</h2><p className="muted">Vous n’avez pas les droits nécessaires pour accéder à cette page.</p></section>;
  }

  return children;
}
