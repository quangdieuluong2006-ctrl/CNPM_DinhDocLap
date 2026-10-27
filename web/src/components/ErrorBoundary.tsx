import { Component, type ErrorInfo, type ReactNode } from "react";

// Lưới an toàn: một lỗi bất ngờ khi render không được làm trắng cả trang – hiện thông báo và nút tải lại.
// Đặt ngoài PrefsProvider nên ghi song ngữ Việt – Anh thay vì dùng bản dịch.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Lỗi giao diện:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-24 max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-semibold">Đã có lỗi xảy ra</p>
        <p className="mt-1 text-sm text-stone-500">Something went wrong</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-brand-700 px-5 py-2 font-semibold text-white transition hover:bg-brand-800"
        >
          Tải lại trang / Reload
        </button>
      </div>
    );
  }
}
