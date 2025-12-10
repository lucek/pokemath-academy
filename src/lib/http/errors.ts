import type { ErrorResponseDto } from '../../types';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ErrorResponseDto['error'],
    public readonly headers?: Record<string, string>,
  ) {
    super(body.message);
    this.name = 'HttpError';
  }
}
