// Bilingual number-to-words converter
// - English uses the "number-to-words" library.
// - Arabic uses a pluggable converter; a simple placeholder is provided, and you can paste
//   your Google Apps Script function and wire it via setArabicConverter().

import converter from 'number-to-words'

// Internal reference to the Arabic converter function.
// Signature: (n: number) => string
let arabicConverter = function placeholderArabicConverter(n) {
  // Basic, limited Arabic integer conversion as a fallback.
  // You should replace this by calling setArabicConverter(yourFunction)
  // with your Google Apps Script implementation for full grammatical accuracy.
  n = Math.round(Number(n) || 0)
  if (!isFinite(n)) return ''
  if (n === 0) return 'صفر'
  if (n < 0) return 'سالب ' + arabicConverter(-n)

  const under20 = ['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر']
  const tensArr = ['','', 'عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون']
  const hundredsArr = ['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة']

  function toWords(num) {
    if (num < 20) return under20[num]
    if (num < 100) {
      const t = Math.floor(num/10), r = num%10
      if (r === 0) return tensArr[t]
      if (r === 1) return 'واحد و' + tensArr[t]
      if (r === 2) return 'اثنان و' + tensArr[t]
      return under20[r] + ' و' + tensArr[t]
    }
    if (num < 1000) {
      const h = Math.floor(num/100), r = num%100
      return hundredsArr[h] + (r ? ' و' + toWords(r) : '')
    }
    if (num < 1_000_000) {
      const th = Math.floor(num/1000), r = num%1000
      let thousands = ''
      if (th === 1) thousands = 'ألف'
      else if (th === 2) thousands = 'ألفان'
      else if (th <= 10) thousands = toWords(th) + ' آلاف'
      else thousands = toWords(th) + ' ألف'
      return thousands + (r ? ' و' + toWords(r) : '')
    }
    if (num < 1_000_000_000) {
      const m = Math.floor(num/1_000_000), r = num%1_000_000
      let millions = ''
      if (m === 1) millions = 'مليون'
      else if (m === 2) millions = 'مليونان'
      else if (m <= 10) millions = toWords(m) + ' ملايين'
      else millions = toWords(m) + ' مليون'
      return millions + (r ? ' و' + toWords(r) : '')
    }
    const b = Math.floor(num/1_000_000_000), r = num%1_000_000_000
    let billions = ''
    if (b === 1) billions = 'مليار'
    else if (b === 2) billions = 'ملياران'
    else if (b <= 10) billions = toWords(b) + ' مليارات'
    else billions = toWords(b) + ' مليار'
    return billions + (r ? ' و' + toWords(r) : '')
  }

  return toWords(n)
}

/**
 * Allow caller to inject a custom Arabic converter (e.g., pasted Google Apps Script function wrapped for Node).
 * @param {(n:number)=>string} fn
 */
export function setArabicConverter(fn) {
  if (typeof fn === 'function') arabicConverter = fn
}

/**
 * Convert a number to its written words representation in the requested language.
 * - Accepts integers and decimals (decimals are rounded by default for English library compatibility).
 * - language: 'en' for English (default), 'ar' for Arabic.
 * @param {number|string} number
 * @param {'en'|'ar'|string} language
 * @returns {string}
 */
export function convertToWords(number, language = 'en') {
  const lang = (language || 'en').toLowerCase()
  const n = Number(number)
  if (!isFinite(n)) return ''

  if (lang === 'ar' || lang.startsWith('arab')) {
    return arabicConverter(n)
  }

  // English: use number-to-words. It supports integers; round decimals.
  const rounded = Math.round(n)
  // number-to-words throws on non-integers; ensure integer
  try {
    return converter.toWords(rounded)
  } catch {
    // fallback to string on unexpected errors
    return String(rounded)
  }
}

export default convertToWords