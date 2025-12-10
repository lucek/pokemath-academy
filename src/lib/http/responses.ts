import type { ErrorResponseDto } from '../../types';

export function jsonError(
  body: ErrorResponseDto['error'],
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: body,
    } satisfies ErrorResponseDto),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...(extraHeaders ?? {}),
      },
    },
  );
}
