/**
 * Converts a range of numbers into Arabic text, handling currency.
 * This function acts like an array formula.
 *
 * @param {range} inputRange The range of cells containing numbers to convert (e.g., V2:V or V2:W10).
 * @param {string} mainCurrency The singular name for the main currency (e.g., "جنيها مصريا").
 * @param {string} subCurrency The singular name for the sub-currency (e.g., "قرش").
 * @return A range of numbers converted to Arabic text.
 * @customfunction
 */
function NUMBERTOARABICTEXT_EG(inputRange, mainCurrency, subCurrency) {
  // Check if the input is a range (an array of arrays)
  if (Array.isArray(inputRange)) {
    // Use .map() to loop through each row, and then each cell in the row
    return inputRange.map(function(row) {
      return row.map(function(cell) {
        // Call the original conversion logic for each individual cell
        return convertSingleNumber(cell, mainCurrency, subCurrency);
      });
    });
  } else {
    // If the input is just a single cell, process it directly
    return convertSingleNumber(inputRange, mainCurrency, subCurrency);
  }
}


/**
 * =================================================================================
 * CORE LOGIC - Converts a SINGLE number to its Arabic text representation.
 * This is your original function, now called by the main wrapper function.
 * =================================================================================
 */
function convertSingleNumber(theNumber, mainCurrency, subCurrency) {
  // Check if theNumber is empty (e.g., an empty cell is passed) or null/undefined.
  // If so, return an empty string to make the cell appear blank.
  if (theNumber === "" || theNumber === null || theNumber === undefined) {
    return ""; // Return blank if the input is empty
  }

  // Arrays for Arabic number words
  const myArry1 = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"]; // Hundreds
  const myArry2 = ["", " عشر", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"]; // Tens
  const myArry3 = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"]; // Units

  const myAnd = " و ";
  let remark = " فقط ";

  // Validate if theNumber is a number after the initial empty check
  if (typeof theNumber !== 'number' || isNaN(theNumber)) {
    return ""; // Return blank for non-numeric values to avoid errors in arrays
  }

  if (theNumber > 999999999999.99) {
    return "Error: Number is too large";
  }
  if (theNumber < -999999999999.99) {
    return "Error: Number is too small";
  }

  if (theNumber < 0) {
    theNumber = theNumber * -1;
    remark = "يتبقى لكم ";
  }

  if (theNumber === 0) {
    return " "; // As per VBA logic (returns a single space for zero)
  }

  // Format the number to always have 12 integer digits and 2 fractional digits
  let numStr = theNumber.toFixed(2);
  let parts = numStr.split('.');
  let integerPartStr = parts[0].padStart(12, '0');
  let fractionalPartStr = parts[1];

  let getNo = integerPartStr + "." + fractionalPartStr;

  let myBillion = "";
  let myMillion = "";
  let myThou = "";
  let myHun = "";
  let myFraction = "";

  /**
   * Helper function to convert a 3-digit number string (000-999) to Arabic text.
   */
  function processThreeDigitsInternal(threeDigitStr) {
    if (!threeDigitStr || threeDigitStr.length !== 3) return "";

    let h = parseInt(threeDigitStr.substring(0, 1), 10);
    let t = parseInt(threeDigitStr.substring(1, 2), 10);
    let u = parseInt(threeDigitStr.substring(2, 3), 10);

    if (h === 0 && t === 0 && u === 0) return "";

    let text100 = myArry1[h];
    let text11 = "إحدى عشر";
    let text12 = "إثنى عشر";

    let tensAndUnitsText = "";

    if (t === 1 && u === 0) {
      tensAndUnitsText = "عشرة";
    } else if (t === 1 && u === 1) {
      tensAndUnitsText = text11;
    } else if (t === 1 && u === 2) {
      tensAndUnitsText = text12;
    } else if (t === 1 && u > 2) {
      tensAndUnitsText = myArry3[u] + myArry2[t].trim();
    } else if (t > 1) {
      if (u > 0) {
        tensAndUnitsText = myArry3[u] + myAnd + myArry2[t].trim();
      } else {
        tensAndUnitsText = myArry2[t].trim();
      }
    } else {
      tensAndUnitsText = myArry3[u];
    }

    if (text100 !== "" && tensAndUnitsText !== "") {
      return text100 + myAnd + tensAndUnitsText;
    } else if (text100 !== "") {
      return text100;
    } else {
      return tensAndUnitsText;
    }
  }

  const segments = [{
    name: "billion",
    valStr: getNo.substring(0, 3),
    unitSingular: " مليار",
    unitDual: " ملياران",
    unitPlural: " مليارات"
  }, {
    name: "million",
    valStr: getNo.substring(3, 6),
    unitSingular: " مليون",
    unitDual: " مليونان",
    unitPlural: " ملايين"
  }, {
    name: "thousand",
    valStr: getNo.substring(6, 9),
    unitSingular: " ألف ",
    unitDual: " ألفان ",
    unitPlural: " آلاف "
  }, {
    name: "hundred",
    valStr: getNo.substring(9, 12),
    unitSingular: "",
    unitDual: "",
    unitPlural: ""
  }, ];

  for (let i = 0; i < segments.length; i++) {
    let segment = segments[i];
    let currentNumStr = segment.valStr;
    let numVal = parseInt(currentNumStr, 10);

    if (numVal === 0) continue;

    let segmentText = processThreeDigitsInternal(currentNumStr);
    if (segmentText === "") continue;

    if (segment.name === "hundred") {
      myHun = segmentText;
    } else {
      if (numVal === 1) {
        if (segment.name === "billion") myBillion = segment.unitSingular.trim();
        else if (segment.name === "million") myMillion = segment.unitSingular.trim();
        else if (segment.name === "thousand") myThou = segment.unitSingular.trim();
      } else if (numVal === 2) {
        if (segment.name === "billion") myBillion = segment.unitDual.trim();
        else if (segment.name === "million") myMillion = segment.unitDual.trim();
        else if (segment.name === "thousand") myThou = segment.unitDual.trim();
      } else if (numVal >= 3 && numVal <= 10) {
        if (segment.name === "billion") myBillion = segmentText + segment.unitPlural;
        else if (segment.name === "million") myMillion = segmentText + segment.unitPlural;
        else if (segment.name === "thousand") myThou = segmentText + segment.unitPlural;
      } else { // numVal > 10
        if (segment.name === "billion") myBillion = segmentText + segment.unitSingular;
        else if (segment.name === "million") myMillion = segmentText + segment.unitSingular;
        else if (segment.name === "thousand") myThou = segmentText + segment.unitSingular;
      }
    }
  }

  let fractionNumStr = "0" + fractionalPartStr;
  myFraction = processThreeDigitsInternal(fractionNumStr);

  let resultParts = [];
  if (myBillion) resultParts.push(myBillion.trim());
  if (myMillion) resultParts.push(myMillion.trim());
  if (myThou) resultParts.push(myThou.trim());
  if (myHun) resultParts.push(myHun.trim());

  let integerText = "";
  if (resultParts.length > 0) {
    integerText = resultParts.join(myAnd).trim();
  }

  let finalOutput = remark;

  if (integerText !== "") {
    finalOutput += integerText + " " + mainCurrency;
    if (myFraction !== "" && myFraction !== "صفر") {
      finalOutput += myAnd + myFraction.trim() + " " + subCurrency;
    }
  } else {
    if (myFraction !== "" && myFraction !== "صفر") {
      finalOutput += myFraction.trim() + " " + subCurrency;
    } else {
      if (parseFloat(theNumber.toFixed(2)) === 0) return " ";
    }
  }

  return finalOutput.replace(/\s+/g, ' ').trim();
}

export default NUMBERTOARABICTEXT_EG;
