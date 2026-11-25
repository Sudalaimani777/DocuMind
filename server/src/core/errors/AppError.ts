export class AppError extends Error {
  constructor(
    public override readonly message: string,
    public readonly statusCode: number = 500,
    public readonly errorCode: string = 'INTERNAL_ERROR',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed on input parameters.', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required. Please sign in.') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict detected', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}
