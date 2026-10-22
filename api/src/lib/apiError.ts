// Lỗi nghiệp vụ có mã chuẩn (PRD v1.0, mục 11.4); errorHandler chuyển thành JSON thống nhất.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
