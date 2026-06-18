import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../guards/ProtectedRoute';
import { AdminRoute } from '../guards/AdminRoute';
import { RuleMakerRoute } from '../guards/RuleMakerRoute';
import { MainLayout } from '../layouts/MainLayout';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ChangePasswordPage } from '../pages/ChangePasswordPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { AdminLayout } from '../pages/admin/AdminLayout';
import { UsersPage } from '../pages/admin/UsersPage';
import { PendingPage } from '../pages/admin/PendingPage';
import { PasswordResetsPage } from '../pages/admin/PasswordResetsPage';
import { AuditLogsPage } from '../pages/admin/AuditLogsPage';
import { RuleTreeEditorPage } from '../pages/rule_tree/RuleTreeEditorPage';
import { CodingPage } from '../pages/coding/CodingPage';
import { PartNumbersPage } from '../pages/coding/PartNumbersPage';
import { BomImportPage } from '../pages/bom/BomImportPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="coding" element={<CodingPage />} />
        <Route path="part-numbers" element={<PartNumbersPage />} />
        <Route path="bom-import" element={<BomImportPage />} />
        <Route
          path="rule-tree"
          element={
            <RuleMakerRoute>
              <RuleTreeEditorPage />
            </RuleMakerRoute>
          }
        />
        <Route path="change-password" element={<ChangePasswordPage />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<UsersPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="pending" element={<PendingPage />} />
          <Route path="password-resets" element={<PasswordResetsPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
