// This is Google AppScript

function doGet(e) {
    const action = e.parameter.action;
  
    if (action === 'read') {
      return handleRead(e);
    }
  
    if (action === 'extreme') {
      return handleExtreme(e);
    }
  
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  function doPost(e) {
    const action = e.parameter.action;
  
    if (action === 'write') {
      return handleWrite(e);
    }
  
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  function handleRead(e) {
    const sheetName = e.parameter.sheet || "Sheet1";
    const rangeStr = e.parameter.range;
  
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
  
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found: " + sheetName }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  
    let data;
    try {
      const range = rangeStr ? sheet.getRange(rangeStr) : sheet.getDataRange();
      data = range.getValues();
  
      // Lọc bỏ các dòng mà tất cả các ô đều rỗng
      data = data.filter(row => row.some(cell => cell !== "" && cell !== null));
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Invalid range: " + rangeStr }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  function handleWrite(e) {
    try {
      const sheetName = e.parameter.sheet || 'Sheet1';
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Sheet not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
  
      const body = JSON.parse(e.postData.contents);
      const values = body.values;
  
      if (!Array.isArray(values) || !Array.isArray(values[0])) {
        throw new Error('Invalid data format. Expecting array of arrays.');
      }
  
      // Lấy tất cả giá trị cột A hiện tại để kiểm tra trùng
      const existingKeys = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat();
      const newUniqueValues = values.filter(row => !existingKeys.includes(row[0]));
  
      if (newUniqueValues.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'skipped', message: 'All entries are duplicates' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
  
      const startRow = sheet.getLastRow() + 1;
      const numRows = newUniqueValues.length;
      const numCols = newUniqueValues[0].length;
  
      sheet.getRange(startRow, 1, numRows, numCols).setValues(newUniqueValues);
  
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', rows_written: numRows }))
        .setMimeType(ContentService.MimeType.JSON);
  
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  function handleExtreme(e) {
    const sheetName = e.parameter.sheet;
    const column = e.parameter.column;
    const type = e.parameter.type || 'max';
  
    try {
      const value = getColumnExtremeValue(sheetName, column, type);
      return ContentService.createTextOutput(JSON.stringify({ value }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  function getColumnExtremeValue(sheetName, columnLetter, type) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  
    const columnIndex = letterToColumn(columnLetter);
    const lastRow = sheet.getLastRow();
    if (lastRow === 1) return "NaN"; // cancel process nếu bảng rỗng  
    const values = sheet.getRange(2, columnIndex, lastRow - 1).getValues(); // bỏ hàng tiêu đề (hàng 1)
  
    const numbers = values.flat().filter(v => typeof v === 'number' && !isNaN(v));
  
    if (numbers.length === 0) return "NaN";
  
    return type === 'min'
      ? Math.min(...numbers)
      : Math.max(...numbers); // default to max
  }
  
  // Helper: Convert column letter to number (e.g., "A" → 1, "D" → 4)
  function letterToColumn(letter) {
    let column = 0;
    for (let i = 0; i < letter.length; i++) {
      column *= 26;
      column += letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
    }
    return column;
  }
  