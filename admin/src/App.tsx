import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { Layout } from "./components/Layout";
import { useAuth } from "./features/auth/AuthProvider";
import { ActiveUsersPage } from "./pages/ActiveUsersPage";
import { ActivityPage } from "./pages/ActivityPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LanguagesPage } from "./pages/LanguagesPage";
import { LoginPage } from "./pages/LoginPage";
import { PlaceEditPage } from "./pages/PlaceEditPage";
import { PlacesPage } from "./pages/PlacesPage";
import { PrintQrPage } from "./pages/PrintQrPage";
import { ToursPage } from "./pages/ToursPage";
import { UsersPage } from "./pages/UsersPage";

// Chưa đăng nhập → về /login, nhớ trang đang mở để quay lại sau khi đăng nhập.
function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <p className="p-6 text-slate-500">Đang kiểm tra phiên đăng nhập…</p>;
  if (status === "guest") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="active-users" element={<ActiveUsersPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="places" element={<PlacesPage />} />
        <Route path="places/:id" element={<PlaceEditPage />} />
        <Route path="languages" element={<LanguagesPage />} />
        <Route path="tours" element={<ToursPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="print-qr" element={<PrintQrPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
