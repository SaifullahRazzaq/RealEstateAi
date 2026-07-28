/**
 * Machine-readable error codes. Clients branch on `code`, never on the message.
 * Identical contract to the one the Postman collection asserts against.
 */
export const ERROR_STATUS = {
  NO_TOKEN: 401,
  TOKEN_INVALID: 401,
  TOKEN_EXPIRED: 401,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  NO_TOKEN: 'Authentication required. Send an Authorization: Bearer <token> header.',
  TOKEN_INVALID: 'Token is invalid or malformed.',
  TOKEN_EXPIRED: 'Token has expired. Please log in again.',
  UNAUTHORIZED: 'Unauthorized.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  VALIDATION_ERROR: 'Request validation failed.',
  NOT_FOUND: 'Resource not found.',
  CONFLICT: 'Resource already exists.',
  INTERNAL_ERROR: 'Something went wrong on our end.',
};

/**
 * Throw this from anywhere in a route; the central error middleware turns it
 * into `{ error, code }` with the right HTTP status.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message?: string) {
    super(message || DEFAULT_MESSAGES[code]);
    this.name = 'ApiError';
    this.code = code;
    this.status = ERROR_STATUS[code];
  }
}

export const badRequest = (message?: string) => new ApiError('VALIDATION_ERROR', message);
export const notFound = (message?: string) => new ApiError('NOT_FOUND', message);
export const forbidden = (message?: string) => new ApiError('FORBIDDEN', message);
