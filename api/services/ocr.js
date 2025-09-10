import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import Tesseract from 'tesseract.js'

/**
 * Attempt cloud OCR first (Google Cloud Vision via API key), then fallback to local Tesseract.
 * Supported env:
 * - GCV_API_KEY: if present, uses Google Cloud Vision "textDetection" REST API
 */
export async function extractTextWithFallback(imagePath) {
  const errors = []
  // 1) Try Google Cloud Vision via REST if API key is present
  const apiKey = process.env.GCV_API_KEY
  if (apiKey) {
    try {
      const text = await extractWithGoogleVision(apiKey, imagePath)
      if (text && text.trim()) {
        return { text, engine: 'google_vision' }
      }
    } catch (e) {
      errors.push({ engine: 'google_vision', error: String(e?.message || e) })
    }
  }

  // 2) Fallback to Tesseract.js local OCR
  try {
    const text = await extractWithTesseract(imagePath)
    return { text, engine: 'tesseract' }
  } catch (e) {
    errors.push({ engine: 'tesseract', error: String(e?.message || e) })
  }

  const err = new Error('All OCR engines failed')
  err.details = errors
  throw err
}

async function extractWithGoogleVision(apiKey, imagePath) {
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`
  const imgBytes = fs.readFileSync(imagePath).toString('base64')
  const body = {
    requests: [
      {
        image: { content: imgBytes },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
      }
    ]
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!resp.ok) {
    let msg = `GCV HTTP ${resp.status}`
    try {
      const j = await resp.json()
      msg += `: ${JSON.stringify(j)}`
    } catch {}
    throw new Error(msg)
  }
  const data = await resp.json()
  const text = data?.responses?.[0]?.fullTextAnnotation?.text || data?.responses?.[0]?.textAnnotations?.[0]?.description || ''
  return text || ''
}

async function extractWithTesseract(imagePath) {
  // Use Arabic and English for better coverage; if languages not present, tesseract.js still tries
  const { data } = await Tesseract.recognize(imagePath, 'ara+eng', {
    logger: () => {}
  })
  return data?.text || ''
}

/**
 * Parse Egyptian ID card text to get key fields
 * - nationalId: first 14-digit sequence
 * - name: after a line containing 'الاسم' or fallback to heaviest latin/arabic name-looking line
 * - address: line(s) containing 'العنوان' or lines following that
 */
export function parseEgyptianIdText(rawText) {
  const out = {
    nationalId: null,
    name: '',
    address: ''
  }
  if (!rawText || typeof rawText !== 'string') return out

  const text = normalize(rawText)
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // National ID: first 14-digit sequence
  const idMatch = text.match(/\b\d{14}\b/)
  if (idMatch) out.nationalId = idMatch[0]

  // Name: try to find line after 'الاسم' or 'Name'
  let name = ''
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (/[اأإآء-ي]\s*الاسم|الاسم|^name\b/i.test(l)) {
      const candidate = lines[i + 1] || ''
      if (candidate) {
        name = candidate
        break
      }
    }
  }
  // If not found, pick the longest line with mostly letters and spaces
  if (!name) {
    name = [...lines]
      .filter(l => {
        const letters = (l.match(/[A-Za-z\u0600-\u06FF]/g) || []).length
        const digits = (l.match(/\d/g) || []).length
        return letters > digits && l.length >= 4 && l.length <= 80
      })
      .sort((a, b) => b.length - a.length)[0] || ''
  }

  // Address: find 'العنوان' or 'Address'
  let address = ''
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (/العنوان|address/i.test(l)) {
      const following = []
      for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
        const s = lines[j]
        if (!s) break
        // Stop if next looks like ID number or date line
        if (/\b\d{14}\b/.test(s) || /\d{2,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/.test(s)) break
        following.push(s)
      }
      address = following.join(' ')
      break
    }
  }
  // Fallback: last 1-2 longish lines
  if (!address) {
    const longish = lines.filter(l => l.length >= 12 && !/\b\d{14}\b/.test(l))
    address = longish.slice(-2).join(' ')
  }

  out.name = cleanInline(name)
  out.address = cleanInline(address)
  return out
}

function normalize(s) {
  return String(s || '').replace(/\u200f|\u200e/g, '')
}
function cleanInline(s) {
  return String(s || '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[:؛،\-–]+$/g, '')
    .trim()
}