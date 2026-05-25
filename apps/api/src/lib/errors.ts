export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(code: string, message: string, status = 400) {
  return { error: { code, message }, status };
}
