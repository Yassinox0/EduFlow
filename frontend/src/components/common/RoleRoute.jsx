import { Navigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

export default function RoleRoute({ roles, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={user.role === "professeur" ? "/teacher/dashboard" : "/dashboard"} replace />;
  }

  return children;
}
