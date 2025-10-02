import { toast } from 'react-toastify'

export function notifyError(err, fallback = 'An error occurred') {
  if (!err) {
    toast.error(fallback)
    return
  }
  try {
    const msg =
      (typeof err === 'string' && err) ||
      err?.error?.message ||
      err?.message ||
      fallback
    toast.error(msg, { autoClose: 5000 })
  } catch {
    toast.error(fallback)
  }
}

export function notifySuccess(message) {
  toast.success(message, { autoClose: 3000 })
}

export function notifyInfo(message) {
  toast.info(message, { autoClose: 3000 })
}