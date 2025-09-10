// Bilingual number-to-words converter
// - English uses the "number-to-words" library with currency-style cents handling ("and XX/100").
// - Arabic uses a converter based on your provided Google Apps Script logic (adapted to Node).
//   You can still override it via setArabicConverter() if you want to plug another version.

import converter from 'number-to-words'

// ==================== Arabic converter (adapted from provided GAS) ====================
let AR_MAIN_CURRENCY = 'جنيها مصريا'
let AR_SUB_CURRENCY = 'قرش'

/**
 * Allow updating default Arabic currency labels.
 * @param {string} mainCurrency e.g., "جنيها مصريا"
 * @param {string} subCurrency e.g., "قرش"
 */
export function setArabicCurrency(mainCurrency, subCurrency) {
  if (typeof mainCurrency === 'string' && mainCurrency.trim()) {
    AR_MAIN_CURRENCY = mainCurrency.trim()
  }
  if (typeof subCurrency === 'string' && subCurrency.trim()) {
    AR_SUB_CURRENCY = subCurrency.trim()
  }
}

/**
 * Core Arabic conversion: converts a SINGLE number to Arabic words with currency.
 * Mirrors the provided convertSingleNumber from Apps Script, adapted to JS.
 * @param {number} theNumber
 * @param {string} mainCurrency
 * @param {string} subCurrency
 * @returns {string}
 */
function convertSingleNumberAR(theNumber, mainCurrency = AR_MAIN_CURRENCY, subCurrency = AR_SUB_CURRENCY) {
  if (theNumber === '' || theNumber === null || theNumber === undefined) {
    return ''
  }

  // Arrays for Arabic number words
  const myArry1 = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'] // Hundreds
  const myArry2 = ['', ' عشر', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'] // Tens
  const myArry3 = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'] // Units

  const myAnd = ' و '
  let remark = ' فقط '

  const n = Number(theNumber)
  if (!isFinite(n)) return ''

  if (n > 999999999999.99) return 'Error: Number is too large'
  if (n < -999999999999.99) return 'Error: Number is too small'

  let number = n
  if (number < 0) {
    number = number * -1
    remark = 'يتبقى لكم '
  }
  if (number === 0) return ' '

  // Ensure 2 decimal digits
  const numStr = number.toFixed(2)
  const parts = numStr.split('.')
  const integerPartStr = parts[0].padStart(12, '0')
  const fractionalPartStr = parts[1]
  const getNo = integerPartStr + '.' + fractionalPartStr

  let myBillion = ''
  let myMillion = ''
  let myThou = ''
  let myHun = ''
  let myFraction = ''

  // Helper to convert 3-digit string to Arabic text
  function processThreeDigitsInternal(threeDigitStr) {
    if (!threeDigitStr || threeDigitStr.length !== 3) return ''

    const h = parseInt(threeDigitStr.substring(0, 1), 10)
    const t = parseInt(threeDigitStr.substring(1, 2), 10)
    const u = parseInt(threeDigitStr.substring(2, 3), 10)

    if (h === 0 && t === 0 && u === 0) return ''

    const text100 = myArry1[h]
    const text11 = 'إحدى عشر'
    const text12 = 'إثنى عشر'

    let tensAndUnitsText = ''

    if (t === 1 && u === 0) {
      tensAndUnitsText = 'عشرة'
    } else if (t === 1 && u === 1) {
      tensAndUnitsText = text11
    } else if (t === 1 && u === 2) {
      tensAndUnitsText = text12
    } else if (t === 1 && u > 2) {
      tensAndUnitsText = myArry3[u] + myArry2[t].trim()
    } else if (t > 1) {
      if (u > 0) tensAndUnitsText = myArry3[u] + myAnd + myArry2[t].trim()
      else tensAndUnitsText = myArry2[t].trim()
    } else {
      tensAndUnitsText = myArry3[u]
    }

    if (text100 !== '' && tensAndUnitsText !== '') return text100 + myAnd + tensAndUnitsText
    if (text100 !== '') return text100
    return tensAndUnitsText
  }

  const segments = [
    { name: 'billion',  valStr: getNo.substring(0, 3),  unitSingular: ' مليار', unitDual: ' ملياران', unitPlural: ' مليارات' },
    { name: 'million',  valStr: getNo.substring(3, 6),  unitSingular: ' مليون', unitDual: ' مليونان', unitPlural: ' ملايين' },
    { name: 'thousand', valStr: getNo.substring(6, 9),  unitSingular: ' ألف ',  unitDual: ' ألفان ',  unitPlural: ' آلاف ' },
    { name: 'hundred',  valStr: getNo.substring(9, 12), unitSingular: '',       unitDual: '',        unitPlural: '' }
  ]

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const currentNumStr = segment.valStr
    const numVal = parseInt(currentNumStr, 10)
    if (numVal === 0) continue

    const segmentText = processThreeDigitsInternal(currentNumStr)
    if (segmentText === '') continue

    if (segment.name === 'hundred') {
      myHun = segmentText
    } else {
      if (numVal === 1) {
        if (segment.name === 'billion') myBillion = segment.unitSingular.trim()
        else if (segment.name === 'million') myMillion = segment.unitSingular.trim()
        else if (segment.name === 'thousand') myThou = segment.unitSingular.trim()
      } else if (numVal === 2) {
        if (segment.name === 'billion') myBillion = segment.unitDual.trim()
        else if (segment.name === 'million') myMillion = segment.unitDual.trim()
        else if (segment.name === 'thousand') myThou = segment.unitDual.trim()
      } else if (numVal >= 3 && numVal <= 10) {
        if (segment.name === 'billion') myBillion = segmentText + segment.unitPlural
        else if (segment.name === 'million') myMillion = segmentText + segment.unitPlural
        else if (segment.name === 'thousand') myThou = segmentText + segment.unitPlural
      } else {
        if (segment.name === 'billion') myBillion = segmentText + segment.unitSingular
        else if (segment.name === 'million') myMillion = segmentText + segment.unitSingular
        else if (segment.name === 'thousand') myThou = segmentText + segment.unitSingular
      }
    }
  }

  const fractionNumStr = '0' + fractionalPartStr
  myFraction = processThreeDigitsInternal(fractionNumStr)

  const resultParts = []
  if (myBillion) resultParts.push(myBillion.trim())
  if (myMillion) resultParts.push(myMillion.trim())
  if (myThou) resultParts.push(myThou.trim())
  if (myHun) resultParts.push(myHun.trim())

  let integerText = ''
  if (resultParts.length > 0) integerText = resultParts.join(myAnd).trim()

  let finalOutput = remark
  if (integerText !== '') {
    finalOutput += integerText + ' ' + mainCurrency
    if (myFraction !== '' && myFraction !== 'صفر') {
      finalOutput += myAnd + myFraction.trim() + ' ' + subCurrency
    }
  } else {
    if (myFraction !== '' && myFraction !== 'صفر') {
      finalOutput += myFraction.trim() + ' ' + subCurrency
    } else {
      if (parseFloat(number.toFixed(2)) === 0) return ' '
    }
  }

  return finalOutput.replace(/\s+/g, ' ').trim()
}

// Current active Arabic converter function pointer.
// Default to our integrated implementation above.
let arabicConverter = function useIntegratedArabicConverter(n) {
  return convertSingleNumberAR(n)
}

/**
 * Allow caller to inject a custom Arabic converter (e.g., another implementation).
 * @param {(n:number)=>string} fn
 */
export function setArabicConverter(fn) {
  if (typeof fn === 'function') arabicConverter = fn
}

// ==================== Public API ====================

/**
 * Convert a number to its written words representation in the requested language.
 * - English uses number-to-words and renders cents as "and XX/100".
 * - Arabic uses the integrated Arabic currency-aware converter (defaults to EGP units).
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

  // English: integer words with cents as "and XX/100"
  const negative = n < 0
  const abs = Math.abs(n)
  const integer = Math.floor(abs + 1e-9)
  const cents = Math.round((abs - integer) * 100)
  let words = ''
  try {
    words = converter.toWords(integer)
  } catch {
    words = String(integer)
  }
  const centsPart = cents > 0 ? ` and ${String(cents).padStart(2, '0')}/100` : ''
  const result = (negative ? 'minus ' : '') + words + centsPart
  return result
}

export default convertToWords