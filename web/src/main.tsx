import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { AuthProvider } from "./features/auth";
import { RealtimeProvider } from "./features/realtime";
import { ApiError } from "./lib/api";
import { PrefsProvider } from "./lib/prefs";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Thử lại tối đa 2 lần cho lỗi mạng/5xx; lỗi 4xx (404 không có điểm…) không thử lại
      retry: (count, err) => count < 2 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PrefsProvider>
          <AuthProvider>
            <RealtimeProvider>
              <App />
            </RealtimeProvider>
          </AuthProvider>
        </PrefsProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
