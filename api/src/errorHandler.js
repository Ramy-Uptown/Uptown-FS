export function errorHandler(err, req, res, next) {
  console.error('Error:', err)
  
  // Database errors
  if (err && err.code === '23505') { // Unique constraint violation
    return res.status(409).json({
      error: {
        message: 'Duplicate entry detected',
        field: err.constraint,
        type: 'duplicate'
      }
    })
  }
  
  if (err && err.code === '23503') { // Foreign key constraint
    return res.status(400).json({
      error: {
        message: 'Referenced item does not exist',
        type: 'reference_error'
      }
    })
  }
  
  // Validation errors
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        details: err.details,
        type: 'validation_error'
      }
    })
  }
  
  // JWT errors
  if (err && err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: {
        message: 'Invalid token',
        type: 'authentication_error'
      }
    })
  }
  
  // Default error
  res.status(500).json({
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'An error occurred processing your request' 
        : (err && err.message) || 'Internal server error',
      type: 'internal_error'
    }
  })
}