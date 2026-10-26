// Hình minh họa mặt tiền Dinh Độc Lập (vẽ tay bằng SVG, không dùng ảnh có bản quyền):
// khối nhà 3 tầng trải ngang, "rèm hoa đá" hình đốt tre che mặt tiền, lầu nhỏ trên sân thượng, cột cờ và đài phun nước phía trước.
export function PalaceArt(props: { className?: string }) {
  const screens = Array.from({ length: 22 }, (_, i) => 92 + i * 19);
  return (
    <svg viewBox="0 0 600 250" fill="none" aria-hidden="true" className={props.className}>
      {/* Lầu sân thượng + mái bằng */}
      <rect x="250" y="38" width="100" height="26" rx="2" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeOpacity="0.5" />
      <path d="M236 38h128" stroke="currentColor" strokeOpacity="0.7" strokeWidth="3" />
      {[262, 280, 298, 316, 334].map((x) => (
        <path key={x} d={`M${x} 42v20`} stroke="currentColor" strokeOpacity="0.35" />
      ))}
      {/* Mái chính */}
      <path d="M60 66h480" stroke="currentColor" strokeOpacity="0.8" strokeWidth="4" strokeLinecap="round" />
      {/* Thân nhà */}
      <rect x="76" y="68" width="448" height="112" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeOpacity="0.45" />
      {/* Rèm hoa đá hình đốt tre */}
      {screens.map((x) => (
        <g key={x} stroke="currentColor" strokeOpacity="0.55">
          <path d={`M${x} 74v76`} strokeWidth="5" strokeLinecap="round" />
          <path d={`M${x - 3} 96h6M${x - 3} 120h6`} strokeOpacity="0.9" />
        </g>
      ))}
      {/* Sàn lầu và hàng cột tầng trệt */}
      <path d="M70 152h460" stroke="currentColor" strokeOpacity="0.7" strokeWidth="3" />
      {Array.from({ length: 12 }, (_, i) => 96 + i * 37).map((x) => (
        <path key={x} d={`M${x} 154v26`} stroke="currentColor" strokeOpacity="0.5" strokeWidth="3" />
      ))}
      {/* Bậc thềm */}
      <path d="M50 182h500M40 188h520" stroke="currentColor" strokeOpacity="0.6" strokeWidth="2" />
      {/* Cột cờ */}
      <path d="M300 196V112" stroke="currentColor" strokeOpacity="0.8" strokeWidth="2" />
      <path d="M300 112l26 6-26 7z" fill="#e2b45a" fillOpacity="0.9" className="origin-left animate-float" />
      {/* Đài phun nước và bãi cỏ */}
      <ellipse cx="300" cy="222" rx="70" ry="10" stroke="currentColor" strokeOpacity="0.5" />
      <path d="M300 220c-6-14-2-22 0-28 2 6 6 14 0 28z" fill="currentColor" fillOpacity="0.35" />
      <path d="M20 236h560" stroke="currentColor" strokeOpacity="0.35" strokeDasharray="2 6" strokeLinecap="round" />
      {/* Hàng cây hai bên */}
      {[30, 64, 536, 570].map((x) => (
        <g key={x}>
          <circle cx={x} cy="198" r="16" fill="currentColor" fillOpacity="0.16" />
          <path d={`M${x} 210v20`} stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
}
