import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { extractTextWithFallback, parseEgyptianIdText } from '../services/ocr.js'
import { authMiddleware } from './authRoutes.js'

const router = express.Router()
const upload = multer({ dest: path.join(os.tmpdir(), 'uploads') })

// POST /api/ocr/egypt-id
// Form-Data: image: <file>
router.post('/egypt-id', authMiddleware, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { message: 'image file is required' } })
  }
  const tmpPath = req.file.path
  try {
    const { text, engine } = await extractTextWithFallback(tmpPath)
    const parsed = parseEgyptianIdText(text || '')
    return res.json({
      ok: true,
      engine,
      rawText: text,
      fields: {
        name: parsed.name || '',
        nationalId: parsed.nationalId || null,
        address: parsed.address || ''
      }
    })
  } catch (e) {
    console.error('OCR error:', e)
    return res.status(500).json({ error: { message: 'OCR failed', details: e?.details || null } })
  } finally {
    try { fs.unlinkSync(tmpPath) } catch {}
  }
})

export default router