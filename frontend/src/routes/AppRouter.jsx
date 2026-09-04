import { BrowserRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../components/common/ProtectedRoute";
import RoleRoute from "../components/common/RoleRoute";
import PermissionRoute from "../components/common/PermissionRoute";
import DashboardLayout from "../layouts/DashboardLayout";
import DashboardPage from "../pages/DashboardPage";
import LoginPage from "../pages/LoginPage";
import MonthlyFeesPage from "../pages/MonthlyFeesPage";
import NotFoundPage from "../pages/NotFoundPage";
import PaymentsPage from "../pages/PaymentsPage";
import AdminPage from "../pages/AdminPage";
import StudentFormPage from "../pages/StudentFormPage";
import StudentProfilePage from "../pages/StudentProfilePage";
import StudentsPage from "../pages/StudentsPage";
import ClassesPage from "../pages/ClassesPage";
import UnpaidPage from "../pages/UnpaidPage";
import SuperAdminDashboardPage from "../pages/SuperAdminDashboardPage";
import SchoolsPage from "../pages/SchoolsPage";
import SchoolDetailsPage from "../pages/SchoolDetailsPage";
import SchoolAdminCreatePage from "../pages/SchoolAdminCreatePage";
import SchedulesPage from "../pages/SchedulesPage";
import SchoolSettingsPage from "../pages/SchoolSettingsPage";
import PersonnelPage from "../pages/PersonnelPage";
import PersonnelFormPage from "../pages/PersonnelFormPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/classes" element={<PermissionRoute permission="classes.view"><ClassesPage /></PermissionRoute>} />
          <Route path="/schedules" element={<PermissionRoute permission="schedules.view"><SchedulesPage /></PermissionRoute>} />
          <Route path="/school-settings" element={<RoleRoute roles={["admin"]}><SchoolSettingsPage /></RoleRoute>} />
          <Route path="/personnel" element={<PermissionRoute permission="personnel.view"><PersonnelPage /></PermissionRoute>} />
          <Route path="/personnel/new" element={<PermissionRoute permission="personnel.manage"><PersonnelFormPage /></PermissionRoute>} />
          <Route path="/personnel/:id/edit" element={<PermissionRoute permission="personnel.manage"><PersonnelFormPage /></PermissionRoute>} />
          <Route path="/students/new" element={<StudentFormPage />} />
          <Route path="/students/:id/edit" element={<StudentFormPage />} />
          <Route path="/students/:id" element={<StudentProfilePage />} />
          <Route path="/payments" element={<PermissionRoute permission="payments.view"><PaymentsPage /></PermissionRoute>} />
          <Route path="/monthly-fees" element={<PermissionRoute permission="monthly_fees.view"><MonthlyFeesPage /></PermissionRoute>} />
          <Route path="/unpaid" element={<PermissionRoute permission="monthly_fees.view"><UnpaidPage /></PermissionRoute>} />
          <Route
            path="/admin"
            element={
              <RoleRoute roles={["admin", "super_admin"]}>
                <AdminPage />
              </RoleRoute>
            }
          />

          <Route
            path="/super-admin/dashboard"
            element={
              <RoleRoute roles={["super_admin"]}>
                <SuperAdminDashboardPage />
              </RoleRoute>
            }
          />
          <Route
            path="/super-admin/schools"
            element={
              <RoleRoute roles={["super_admin"]}>
                <SchoolsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/super-admin/schools/:id"
            element={
              <RoleRoute roles={["super_admin"]}>
                <SchoolDetailsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/super-admin/schools/:id/admin"
            element={
              <RoleRoute roles={["super_admin"]}>
                <SchoolAdminCreatePage />
              </RoleRoute>
            }
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
