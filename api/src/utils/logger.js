import pino from 'pino'

const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production'

const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  base: isProd ? { env: 'production' } : undefined,
  timestamp: pino.stdTimeFunctions.isoTime
})

export default logger