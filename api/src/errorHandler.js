import logger from './utils/logger.js'

const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production'

export function errorHandler(err, req, res, next) {
  const status =
    err?.statusCode ||
    (err?.code === '23505' ? 409 :
     err?.code === '23503' ? 400 :
     err?.name === 'JsonWebTokenError' ? 401 :
     err?.name === 'ValidationError' ? 400 :
     500)

  const type =
    err?.type ||
    (err?.code === '23505' ? 'duplicate' :
     err?.code === '23503' ? 'reference_error' :
     err?.name === 'JsonWebTokenError' ? 'authentication_error' :
     err?.name === 'ValidationError' ? 'validation_error' :
     'internal_error')

  const message =
    isProd
      ? (status >= 500 ? 'An error occurred processing your request' : err?.message || 'Request error')
      : err?.message || 'Internal server error'

  const payload = {
    error: {
      message,
      type,
      statusCode: status,
      details: err?.details || undefined
    },
    requestId: req.id || undefined // echo back correlation id
  }

  // Structured error logging with context; avoid logging sensitive bodies
  logger.error({
    msg: err?.message || 'Unhandled error',
    type,
    statusCode: status,
    stack: isProd ? undefined : err?.stack,
    req: {
      id: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      userId: req.user?.id || null,
      ip: req.ip
    }
  })

  res.status(status).json(payload)
}