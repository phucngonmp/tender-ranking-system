import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { RoleName } from '../types';

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="page-loading">Đang tải...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export function AdminRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="page-loading">Đang tải...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== ('admin' as RoleName)) {
    return <Navigate to="/tenders" replace />;
  }
  return <Outlet />;
}
