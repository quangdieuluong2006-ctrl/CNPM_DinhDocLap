import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { Layout } from "./components/Layout";
import { useAuth } from "./features/auth";
import { AuthPage } from "./pages/AuthPage";
import { MePage } from "./pages/MePage";
import { HomePage } from "./pages/HomePage";
import { MapPage } from "./pages/MapPage";
import { PlaceDetailPage } from "./pages/PlaceDetailPage";
import { PlacesPage } from "./pages/PlacesPage";
import { TourPage } from "./pages/TourPage";
import { ToursHomePage } from "./pages/ToursHomePage";

// Trang cần đăng nhập: chưa đăng nhập → /login, nhớ trang đang mở để quay lại.
function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <p className="text-stone-500">…</p>;
  if (status === "guest") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

// Route theo PRD v1.0, mục 6
export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="places" element={<PlacesPage />} />
        <Route path="p/:code" element={<PlaceDetailPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route path="tour" element={<ToursHomePage />} />
        <Route
          path="tour/:code"
          element={
            <RequireAuth>
              <TourPage />
            </RequireAuth>
          }
        />
        <Route
          path="me"
          element={
            <RequireAuth>
              <MePage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
