import { Navigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

export default function ProtectedRoute({ children, allowPasswordChange = false }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (user.must_change_password && !allowPasswordChange) {
    return <Navigate to="/account/activate" replace />;
  }
  return children;
}
