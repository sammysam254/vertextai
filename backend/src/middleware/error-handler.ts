// ==============================================
// Custom Error Classes and Handler
// ==============================================

import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@/lib/logger';
import { config } from '@/lib/config';

const logger = createLogger('error-handler');

// ==============================================
// Custom Error Classes
// ==============================================

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string = 'External service error'
  ) {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
  }
}

// ==============================================
// Error Response Formatter
// ==============================================

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  code?: string;
  details?: unknown;
  timestamp: string;
  path: string;
  requestId?: string;
}

export function formatErrorResponse(
  error: Error | FastifyError | AppError,
  request: FastifyRequest
): ErrorResponse {
  const statusCode =
    'statusCode' in error ? error.statusCode || 500 : 500;

  const response: ErrorResponse = {
    error: getErrorName(statusCode),
    message: getErrorMessage(error, statusCode),
    statusCode,
    timestamp: new Date().toISOString(),
    path: request.url,
    requestId: request.id,
  };

  // Add error code if available
  if ('code' in error && error.code) {
    response.code = error.code;
  }

  // Add validation details if available
  if (error instanceof ValidationError && error.details) {
    response.details = error.details;
  }

  // Add Fastify validation details
  if ('validation' in error && error.validation) {
    response.details = error.validation;
  }

  return response;
}

function getErrorName(statusCode: number): string {
  const errorNames: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };

  return errorNames[statusCode] || 'Error';
}

function getErrorMessage(
  error: Error | FastifyError | AppError,
  statusCode: number
): string {
  // In production, hide internal error details for 5xx errors
  if (config.nodeEnv === 'production' && statusCode >= 500) {
    return 'An internal error occurred. Please try again later.';
  }

  return error.message || 'An error occurred';
}

// ==============================================
// Error Logger
// ==============================================

export function logError(
  error: Error | FastifyError | AppError,
  request: FastifyRequest
) {
  const statusCode =
    'statusCode' in error ? error.statusCode || 500 : 500;

  const logContext = {
    error: {
      name: error.name,
      message: error.message,
      stack: config.nodeEnv === 'production' ? undefined : error.stack,
      code: 'code' in error ? error.code : undefined,
    },
    request: {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
    },
    statusCode,
  };

  // Log level based on status code
  if (statusCode >= 500) {
    logger.error(logContext, 'Server error');
  } else if (statusCode >= 400) {
    logger.warn(logContext, 'Client error');
  } else {
    logger.info(logContext, 'Request error');
  }
}

// ==============================================
// Global Error Handler
// ==============================================

export async function globalErrorHandler(
  error: Error | FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log the error
  logError(error, request);

  // Format and send error response
  const errorResponse = formatErrorResponse(error, request);

  return reply.status(errorResponse.statusCode).send(errorResponse);
}

// ==============================================
// Async Error Wrapper
// ==============================================

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler<T>(
  handler: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => Promise<T>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      throw error; // Let Fastify's error handler catch it
    }
  };
}
