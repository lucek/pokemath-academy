import { HttpError } from './errors';

export async function parseRequestBody(request: Request, routeLabel?: string): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.debug(`${routeLabel ?? '[request]'} Invalid JSON payload.`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new HttpError(400, {
      code: 'invalid_request_body',
      message: 'Request body must be valid JSON.',
    });
  }
}
