let lastCleanupAt = null
let lastDeleted = { refreshTokens: 0, passwordResetTokens: 0 }
let totalDeleted = { refreshTokens: 0, passwordResetTokens: 0 }
let runs = 0

export function recordCleanup({ refreshTokens = 0, passwordResetTokens = 0 }) {
  lastCleanupAt = new Date()
  lastDeleted = { refreshTokens, passwordResetTokens }
  totalDeleted.refreshTokens += refreshTokens
  totalDeleted.passwordResetTokens += passwordResetTokens
  runs += 1
}

export function getCleanupMetrics() {
  return {
    lastCleanupAt,
    lastDeleted,
    totalDeleted,
    runs
  }
}