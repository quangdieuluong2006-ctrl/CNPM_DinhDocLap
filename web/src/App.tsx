import { Navigate, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { MapPage } from "./pages/MapPage";
import { MePage } from "./pages/MePage";
import { PlaceDetailPage } from "./pages/PlaceDetailPage";
import { PlacesPage } from "./pages/PlacesPage";

// Khách quét QR là dùng ngay: không có trang đăng nhập / đăng ký (phiên khách ẩn danh tạo tự động – features/auth.tsx).
// Liên kết cũ /login, /register, /tour… chuyển về trang chủ.
export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="places" element={<PlacesPage />} />
        <Route path="p/:code" element={<PlaceDetailPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="me" element={<MePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
