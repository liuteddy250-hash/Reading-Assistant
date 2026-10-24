export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error('[api] unhandled error:', error);
  const message = error instanceof Error ? error.message : '服务器内部错误';
  return Response.json({ error: message }, { status: 500 });
}
