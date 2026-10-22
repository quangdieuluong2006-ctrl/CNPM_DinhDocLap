// Danh mục ngôn ngữ ISO 639-1 để admin thêm ngôn ngữ thuyết minh (PRD v1.0, FE-22).
// Tên tiếng Việt/tiếng Anh/bản ngữ lấy từ Intl.DisplayNames (dữ liệu CLDR có sẵn trong Node), không cần tự dịch.
const ISO_639_1 =
  "aa ab ae af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu " +
  "fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km " +
  "kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om " +
  "or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr " +
  "ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu";

export interface CatalogLanguage {
  code: string;
  nameVi: string;
  nameEn: string;
  nameNative: string;
  ttsLocale: string; // BCP 47 cho giọng tổng hợp, ví dụ ja-JP
}

const viNames = new Intl.DisplayNames(["vi"], { type: "language", fallback: "code" });
const enNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "code" });

function capitalize(s: string, locale: string): string {
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
}

function build(code: string): CatalogLanguage {
  let nameNative = code;
  try {
    nameNative = capitalize(new Intl.DisplayNames([code], { type: "language", fallback: "code" }).of(code) ?? code, code);
  } catch {
    // Ngôn ngữ không có dữ liệu CLDR: dùng tên tiếng Anh.
    nameNative = enNames.of(code) ?? code;
  }
  // maximize() suy ra vùng phổ biến nhất: "ja" → "ja-Jpan-JP" → ja-JP.
  const max = new Intl.Locale(code).maximize();
  return {
    code,
    nameVi: capitalize(viNames.of(code) ?? code, "vi"),
    nameEn: enNames.of(code) ?? code,
    nameNative,
    ttsLocale: max.region ? `${code}-${max.region}` : code,
  };
}

export const LANGUAGE_CATALOG: CatalogLanguage[] = ISO_639_1.split(" ").map(build);

// Bỏ dấu để gõ "nhat" vẫn ra "Tiếng Nhật".
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export function searchCatalog(q: string | undefined): CatalogLanguage[] {
  if (!q) return LANGUAGE_CATALOG;
  const needle = fold(q.trim());
  return LANGUAGE_CATALOG.filter(
    (l) => l.code === needle || [l.nameVi, l.nameEn, l.nameNative].some((n) => fold(n).includes(needle)),
  );
}

export function catalogEntry(code: string): CatalogLanguage | undefined {
  return LANGUAGE_CATALOG.find((l) => l.code === code);
}
