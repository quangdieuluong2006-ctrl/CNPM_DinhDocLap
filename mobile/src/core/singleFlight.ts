// Gộp các lần gọi đồng thời thành một: nhiều request cùng gặp token hết hạn chỉ gọi /auth/refresh MỘT lần
// (refresh token xoay vòng – gọi hai lần song song thì lần sau dùng token đã bị thu hồi và mất phiên).
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    inFlight ??= fn().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
