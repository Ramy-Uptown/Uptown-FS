export class AppError extends Error {
  constructor(message, statusCode = 500, type = 'internal_error', details = null) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.type = type
    this.details = details
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized', statusCode = 401, details = null) {
    super(message, statusCode, 'authentication_error', details)
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', statusCode = 403, details = null) {
    super(message, statusCode, 'forbidden', details)
    this.name = 'ForbiddenError'
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400, 'validation_error', details)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', details = null) {
    super(message, 404, 'not_found', details)
    this.name = 'NotFoundError'
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database error', statusCode = 500, details = null) {
    super(message, statusCode, 'database_error', details)
    this.name = 'DatabaseError'
  }
}