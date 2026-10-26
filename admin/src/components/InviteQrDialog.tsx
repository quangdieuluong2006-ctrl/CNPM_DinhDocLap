import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet } from "../lib/api";

interface JoinLink {
  url: string;
  label: string;
  recommended: boolean;
}

// Hộp thoại chiếu mã QR để khách quét bằng điện thoại và dùng Web User ngay (không cần đăng ký).
// Điện thoại phải dùng CÙNG mạng Wi-Fi với máy đang chạy Web User.
export function InviteQrDialog({ onClose }: { onClose: () => void }) {
  const links = useQuery({ queryKey: ["join-link"], queryFn: () => apiGet<{ links: JoinLink[] }>("/admin/join-link") });
  const [index, setIndex] = useState(0);
  const [qr, setQr] = useState<string | null>(null);
  const all = links.data?.links ?? [];
  const selected = all[index];

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    QRCode.toDataURL(selected.url, { width: 360, margin: 1 }).then((data) => alive && setQr(data));
    return () => {
      alive = false;
    };
  }, [selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portal ra <body>, z-index trên thanh tiêu đề dính: mã QR không bị che (thiếu góc định vị thì điện thoại không quét được)
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mời tham gia bằng mã QR"
        className="max-h-[95vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl bg-white p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-slate-900">Quét mã để tham gia</h2>
        <p className="text-sm text-slate-500">Dùng camera điện thoại quét mã là nghe thuyết minh ngay – không cần đăng ký; khách xuất hiện trong danh sách đang hoạt động với tên "Khách #…".</p>

        {links.isPending && <p className="text-slate-500">Đang lấy địa chỉ mạng…</p>}
        {links.isError && <p className="text-red-700">Không lấy được địa chỉ: {links.error.message}</p>}
        {links.data && links.data.links.length === 0 && (
          <p className="text-amber-700">Máy chưa kết nối mạng Wi-Fi/LAN nào – điện thoại sẽ không truy cập được.</p>
        )}

        {selected && (
          <>
            {qr ? <img src={qr} alt={`Mã QR tới ${selected.url}`} className="mx-auto h-72 w-72" /> : <div className="mx-auto h-72 w-72" />}
            <p className="break-all font-mono text-base font-semibold text-slate-900">{selected.url}</p>
            {all.length > 1 && (
              <label className="block text-left text-sm text-slate-600">
                Mạng (chọn mạng Wi-Fi mà điện thoại đang dùng):
                <select value={index} onChange={(e) => setIndex(Number(e.target.value))} className="mt-1 w-full rounded-md border px-2 py-1.5">
                  {all.map((l, i) => (
                    <option key={l.url} value={i}>
                      {l.label} – {new URL(l.url).hostname}
                      {l.recommended ? " (khuyên dùng)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="text-xs text-slate-500">
              Điện thoại cần dùng cùng Wi-Fi với máy này. Không mở được: kiểm tra Web User đang chạy (<code>npm run dev</code> trong thư
              mục <code>web</code>) và Windows Firewall cho phép cổng 5173.
            </p>
          </>
        )}

        <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-100">
          Đóng
        </button>
      </div>
    </div>,
    document.body,
  );
}
