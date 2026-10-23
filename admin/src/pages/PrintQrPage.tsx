import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button, ErrorBox, inputCls, PageHeader } from "../components/ui";
import { apiGet } from "../lib/api";
import { ZONE_LABEL } from "../lib/format";

interface PublicPlace {
  id: number;
  code: string;
  trigger: "gps" | "indoor";
  zone: string;
  content: { title: string } | null;
}

const KEY = "printQr.baseUrl";

// FE-24 In mã QR: mỗi ô gồm QR (liên kết https://<web-user>/p/{số}), số điểm, tên tiếng Việt và tiếng Anh.
// Quét bằng camera điện thoại: đã cài ứng dụng thì mở thẳng điểm, chưa cài thì mở trang Web User (PRD mục 4.4).
export function PrintQrPage() {
  const join = useQuery({ queryKey: ["join-link"], queryFn: () => apiGet<{ links: { url: string; recommended: boolean }[] }>("/admin/join-link") });
  const vi = useQuery({ queryKey: ["public-places", "vi"], queryFn: () => apiGet<{ items: PublicPlace[] }>("/places?lang=vi") });
  const en = useQuery({ queryKey: ["public-places", "en"], queryFn: () => apiGet<{ items: PublicPlace[] }>("/places?lang=en") });
  const [base, setBase] = useState(() => localStorage.getItem(KEY) ?? "");
  const [onlyIndoor, setOnlyIndoor] = useState(true);
  const [qrs, setQrs] = useState<Record<string, string>>({});

  // Mặc định: địa chỉ Web User trong mạng nội bộ (giống mã "Mời tham gia"); khi đã triển khai thì nhập địa chỉ thật.
  useEffect(() => {
    if (base || !join.data) return;
    const rec = join.data.links.find((l) => l.recommended) ?? join.data.links[0];
    if (rec) setBase(new URL(rec.url).origin);
  }, [join.data, base]);

  const enTitle = new Map((en.data?.items ?? []).map((p) => [p.code, p.content?.title ?? ""]));
  const places = (vi.data?.items ?? []).filter((p) => !onlyIndoor || p.trigger === "indoor");
  const cleanBase = base.trim().replace(/\/$/, "");

  useEffect(() => {
    let alive = true;
    void Promise.all(places.map(async (p) => [p.code, await QRCode.toDataURL(`${cleanBase}/p/${p.code}`, { width: 300, margin: 1 })] as const)).then(
      (pairs) => alive && setQrs(Object.fromEntries(pairs)),
    );
    return () => {
      alive = false;
    };
  }, [cleanBase, places.map((p) => p.code).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <div className="space-y-4 print:hidden">
        <PageHeader title="In mã QR cho các phòng" subtitle="In khổ A4 (6 ô/trang), cắt ra và đặt tại cửa từng phòng." actions={<Button variant="primary" onClick={() => window.print()}>🖨 In</Button>} />
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <label className="block w-96">
            <span className="font-medium text-slate-700">Địa chỉ Web User</span>
            <input
              value={base}
              onChange={(e) => {
                setBase(e.target.value);
                localStorage.setItem(KEY, e.target.value);
              }}
              placeholder="https://dinhdoclap.vercel.app"
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={onlyIndoor} onChange={(e) => setOnlyIndoor(e.target.checked)} />
            Chỉ điểm trong nhà
          </label>
        </div>
        {(vi.isError || en.isError) && <ErrorBox error={(vi.error ?? en.error)!} />}
      </div>

      <div className="grid grid-cols-2 gap-4 print:gap-0">
        {places.map((p) => (
          <div key={p.code} className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 text-center print:h-[93mm] print:rounded-none">
            <p className="text-xs uppercase tracking-widest text-slate-500">Dinh Độc Lập · {ZONE_LABEL[p.zone]}</p>
            {qrs[p.code] ? <img src={qrs[p.code]} alt={`QR điểm ${p.code}`} className="h-40 w-40" /> : <div className="h-40 w-40" />}
            <p className="font-mono text-4xl font-bold text-emerald-900">{p.code}</p>
            <p className="font-semibold text-slate-900">{p.content?.title}</p>
            <p className="text-sm text-slate-600">{enTitle.get(p.code)}</p>
            <p className="text-xs text-slate-500">Quét mã hoặc nhập số {p.code} trong ứng dụng · Scan or enter {p.code} in the app</p>
          </div>
        ))}
      </div>
    </div>
  );
}
