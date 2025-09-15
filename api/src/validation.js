import Joi from 'joi'

// Offer validation schema
export const offerSchema = Joi.object({
  title: Joi.string().min(3).max(255).required(),
  unitId: Joi.number().integer().positive().required(),
  customerId: Joi.number().integer().positive().required(),
  totalPrice: Joi.number().precision(2).positive().required(),
  discountPercent: Joi.number().min(0).max(100).required(),
  paymentPlan: Joi.string().valid('standard', 'custom').required(),
  paymentFrequency: Joi.string().valid('monthly', 'quarterly', 'bi-annually', 'annually').required(),
  termYears: Joi.number().integer().min(1).max(30).required(),
  downPaymentPercent: Joi.number().min(0).max(100).required(),
  additionalNotes: Joi.string().allow('').optional()
})

// Block validation schema
export const blockSchema = Joi.object({
  unitId: Joi.number().integer().positive().required(),
  durationDays: Joi.number().integer().min(1).max(7).required(),
  reason: Joi.string().min(10).max(500).required()
})

// Customer validation schema
export const customerSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(5).max(20).required(),
  nationality: Joi.string().allow('').optional(),
  idNumber: Joi.string().allow('').optional(),
  idType: Joi.string().allow('').optional(),
  address: Joi.string().allow('').optional(),
  dateOfBirth: Joi.date().allow('').optional(),
  occupation: Joi.string().allow('').optional(),
  company: Joi.string().allow('').optional()
})

// Middleware to validate request body
export function validateRequest(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body)
    if (error) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          details: error.details,
          type: 'validation_error'
        }
      })
    }
    next()
  }
}