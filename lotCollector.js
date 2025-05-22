// Tamper Monkey Script
// ==UserScript==
// @name         Simple Data Collector
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Collects data sets with titles and content lists in a floating popup, with pre-extraction form submission using a dynamic date at initialization
// @author       Viet Cat
// @match        https://ketqua04.net/*
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// ==/UserScript==

/**
 * Main script function - wrapped in IIFE for scope isolation
 * This script creates a floating popup to collect and display data sets
 * Features:
 * - Auto-refresh with dynamic intervals (5s default, 2s if no data, 30s if data found)
 * - Manual refresh with visual feedback
 * - Pause/resume functionality
 * - Draggable and resizable popup
 * - Collapsible interface
 * - Pre-extraction form submission at initialization with dynamic date
 */
(function() {
    'use strict';

    try {
        console.log('Data Collector: Script starting...');

        // Global variables for refresh functionality
        let timeLeft = 5;                    // Countdown timer
        let refreshIntervalId = null;        // Stores interval ID for cleanup
        let isPaused = false;                // Tracks pause state
        window.dataCollectorInterval = 5;    // Default refresh interval
        let originalWidth = 300;             // Store original popup width
        let originalHeight = 0;              // Store original popup height
        const dateCount = 300;               // Date count (range) for result page
        const STOP_EXECUTION = "STOP_EXECUTION_SIGNAL"; // Khai báo hằng số ở đây

        //Global variables for sheets
        const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
        const API_KEY = 'YOUR_API_KEY_HERE'; // optional, can be left blank if only using OAuth
        const DISCOVERY_DOCS = [
        "https://sheets.googleapis.com/$discovery/rest?version=v4"
        ];
        const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
        const spreadsheetId = 'YOUR_SPREADSHEET_ID';
        const range = 'Sheet1!A1';
        const valueInputOption = 'RAW';

        let tokenClient;
        let gapiInited = false;
        let gisInited = false;

        const SHEET_API_BASE_URL = "https://script.google.com/macros/s/AKfycbxuDJA_Y4Ht_JBQF_wL0vrz6FP-2r3Izf7lIVXyvE1hTmqDHQRcRLnGbY_dfwut8gec/exec";

        let minDateTimestamp = 0; //store the earliest date in the data
        let maxDateTimestamp = 0; //store the latest date in the data
        let values = []; //dataset of all results found on page

        /**
         * Helper function to create a delay
         * @param {number} ms - Milliseconds to wait
         * @returns {Promise} - Resolves after the specified delay
         */
        function delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Helper function to format the current date as DD-MM-YYYY
         * @returns {number} - current Uix timestamp
         */
        function getCurrentUnixTimestamp() {
            // Date.now() trả về số mili giây kể từ Unix epoch.
            // Chia cho 1000 để đổi sang giây và làm tròn xuống.
            return Math.floor(Date.now() / 1000);
        }

        /**
         * Helper function to format the current date as DD-MM-YYYY
         * @returns {string} - Today's date in DD-MM-YYYY format
         */
        function getTodayDate() {
            const today = new Date();
            const day = String(today.getUTCDate()).padStart(2, '0');
            const month = String(today.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-based
            const year = today.getUTCFullYear();
            return `${day}-${month}-${year}`;
        }

        /**
         * Helper function to extract date text
         * @param {String} text - Text that contains date (in dd-mm-yyyy format)
         * @returns {String} - Extracted date in dd-mm-yyyy format
         */
        function extractDate(text) {
            const match = text.match(/\b\d{2}-\d{2}-\d{4}\b/);
            return match ? match[0] : null;
        }
        
        /**
         * Helper function to get Unix UTC timestamp
         * @param {String} dateStr - Text that contains date (in dd-mm-yyyy format)
         * @returns {int} - UTC Unix timestamp
         */
        function getUnixUTCTimestamp(dateStr) {
            const [day, month, year] = dateStr.split('-').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed
            return Math.floor(date.getTime() / 1000); // convert from ms to seconds
        }

        /**
         * Helper function to get Unix UTC timestamp
         * @param {String} timestamp - UTC Unix timestamp
         * @returns {int} - Text that contains date (in dd-mm-yyyy format)
         */
        function formatDateFromTimestamp(timestamp) {
            const date = new Date(timestamp * 1000); // nhân 1000 để từ giây thành mili-giây
            const day = String(date.getUTCDate()).padStart(2, '0');
            const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // tháng bắt đầu từ 0
            const year = date.getUTCFullYear();
            return `${day}-${month}-${year}`;
        }

        /**
         * Helper function to calculate new date with offset
         * @param {String} dateStr - Date in dd-mm-yyyy format
         * @param {String} offsetDays - Number of days to offset (positive number to offset forward, negative number to offset backward)
         * @returns {String} - New date with offset
         */
        function offsetDate(dateStr, offsetDays) {
            // Validate input format
            if (!/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
                return "Invalid date format. Use dd-mm-yyyy";
            }
            
            // Parse input date
            const [day, month, year] = dateStr.split('-').map(Number);
            
            // Create Date object (month is 0-based in JS)
            const date = new Date(year, month - 1, day);
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                return "Invalid date";
            }
            
            // Add offset days
            date.setDate(date.getDate() + Number(offsetDays));
            
            // Format output
            const newDay = String(date.getDate()).padStart(2, '0');
            const newMonth = String(date.getMonth() + 1).padStart(2, '0');
            const newYear = date.getFullYear();
            
            return `${newDay}-${newMonth}-${newYear}`;
        }

        /**
         * Helper function to convert date format
         * @param {String} dateStr - Date in either dd-mm-yyyy or dd/mm/yyyy format
         * @returns {String} - New date format (either dd-mm-yyyy or dd/mm/yyyy format)
         */
        function convertDateFormat(dateStr) {
            // Check if input is dd-mm-yyyy format
            if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
                // Parse input date
                const [day, month, year] = dateStr.split('-').map(Number);
        
                // Create Date object (month is 0-based in JS)
                const date = new Date(year, month - 1, day);
        
                // Check if date is valid
                if (isNaN(date.getTime())) {
                    return "Invalid date";
                }
        
                // Convert to Ddd/Mmm/yyyy (e.g., D15/M06/2025)
                const formattedDay = `${String(day).padStart(2, '0')}`;
                const formattedMonth = `${String(month).padStart(2, '0')}`;
        
                return `${formattedDay}/${formattedMonth}/${year}`;
            }
            // Check if input is Ddd/Mmm/yyyy format (e.g., D15/M06/2025)
            else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
                // Parse input date
                const [dayPart, monthPart, year] = dateStr.split('/');
        
                // Create Date object
                const date = new Date(year, month - 1, day);
        
                // Check if date is valid
                if (isNaN(date.getTime())) {
                    return "Invalid date";
                }
        
                // Convert to dd-mm-yyyy
                const formattedDay = String(day).padStart(2, '0');
                const formattedMonth = String(month).padStart(2, '0');
        
                return `${formattedDay}-${formattedMonth}-${year}`;
            }
            // Invalid format
            else {
                return "Invalid date format. Use dd-mm-yyyy or dd/mm/yyyy (e.g., 15-06-2025 or 15/06/2025)";
            }
        }

        /**
         * Helper function to convert date format
         * @param {String} dateStr - Date in either dd-mm-yyyy or d-m-yyyy format
         * @returns {String} - New date format is always dd-mm-yyyy format
         */
        function normalizeDateString(dateStr) {
            // Tách chuỗi thành các phần ngày, tháng, năm dựa trên dấu '-'
            const parts = dateStr.split('-');
        
            if (parts.length === 3) {
                let day = parts[0];
                let month = parts[1];
                const year = parts[2];
        
                // Thêm '0' vào trước nếu ngày chỉ có 1 chữ số
                if (day.length === 1) {
                    day = '0' + day;
                }
                // Thêm '0' vào trước nếu tháng chỉ có 1 chữ số
                if (month.length === 1) {
                    month = '0' + month;
                }
                return `${day}-${month}-${year}`;
            }
            // Trả về chuỗi gốc nếu định dạng không như mong đợi để tránh lỗi
            console.warn("Unexpected date format for normalization:", dateStr);
            return dateStr;
        }

        /**
         * Helper function to extract text content using XPath
         * @param {string} xpath - XPath expression to evaluate
         * @param {Node} context - Context node for XPath evaluation
         * @returns {string} - Concatenated text content from matching nodes
         */
        function getTextContent(xpath, context) {
            try {
                const result = document.evaluate(xpath, context, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                let text = '';
                for (let i = 0; i < result.snapshotLength; i++) {
                    text += result.snapshotItem(i).textContent.trim();
                }
                return text.trim();
            } catch (error) {
                window.logToPopup('Data Collector: Error in getTextContent:\n' + error);
                return '';
            }
        }

        /**
         * Executes the pre-extraction form submission
         * @param {string} date - Date to set in the datepicker (format: DD-MM-YYYY)
         * @returns {Promise<boolean>} - Resolves to true if successful, false otherwise
         */
        async function executePreExtractionSnippet(date) {
            try {
                if (typeof jQuery === 'undefined') {
                    console.log('jQuery not available, skipping pre-extraction snippet');
                    return false;
                }

                if (!date || typeof date !== 'string' || !/^\d{2}-\d{2}-\d{4}$/.test(date)) {
                    console.log('Invalid or missing date parameter, skipping pre-extraction snippet');
                    return false;
                }

                const $ = jQuery;
                let success = true;

                console.log(`Expected date is ${date}\nPicker date is ${$('#date').val()}`);
                // Update datepicker
                if(normalizeDateString($('#date').val()) == date){
                    console.log(`Datepicker already updated to ${date}. No need to make change.`);
                    return false; //if the current selected date is the one to update then no need to do anything
                } else {
                    if ($('#date').length) {
                        $('#date').datepicker('update', date);
                        console.log(`Datepicker updated to ${date}`);
                    } else {
                        console.log('Datepicker element (#date) not found');
                        success = false;
                    }
    
                    // Set count value
                    if ($('#count').length) {
                        $('#count').val(dateCount);
                        console.log(`Count input set to ${dateCount}`);
                    } else {
                        console.log('Count input (#count) not found');
                        success = false;
                    }
                    // Click submit button
                    const submitButton = document.querySelector('#so-ket-qua button[type="submit"]');
                    if (submitButton) {
                        submitButton.click();
                        console.log('Submit button clicked');
                    } else {
                        console.log('Submit button (#so-ket-qua button[type="submit"]) not found');
                        success = false;
                    }
                }

                // Wait for page to update (adjustable delay)
                // await delay(3000); // 3-second delay to allow page update
                console.log('Returning success: ',success);
                return success;
            } catch (error) {
                console.error('Error in pre-extraction snippet', error);
                return false;
            }
        }

        /**
         * Extracts data sets from the page using XPath
         * @returns {Array} - Array of data sets with title and content
         */
        async function extractDataFromPage() {
            try {
                window.logToPopup('Data Collector: Starting data extraction...');

                // Main XPath for finding match components
                const mainXPath = "//div[contains(@class, 'kqbackground viento')]/div[contains(@class, 'panel-default')]/div[contains(@class, 'panel-body')]/div[contains(@class, 'kqbackground')]";
                
                // XPath expressions for data
                const xpathExpressions = {
                    title: "./div[@id = 'outer_result_mb']/div[@id = 'result_mb']/div[contains(@class, 'row')]/div[contains(@class, 'col-sm-6')]/div/table/thead//text()",
                    content: "./div[@id = 'outer_result_mb']/div[@id = 'result_mb']/div[contains(@class, 'row')]/div[2]/table/tbody/tr/td[2]"
                };

                // Get all match components
                const days = document.evaluate(mainXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                const extractedData = [];
                let currentId = 1;

                // Process each match
                for (let i = 0; i < days.snapshotLength; i++) {
                    const day = days.snapshotItem(i);
                    
                    // Get title (combine team names and time)
                    const titleParts = getTextContent(xpathExpressions.title, day).split(/\s+/).filter(part => part);
                    const title = titleParts.join(' ').trim();
                    
                    // Get content (all odds and handicaps)
                    const contentNodes = document.evaluate(xpathExpressions.content, day, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    const content = [];
                    for (let j = 0; j < contentNodes.snapshotLength; j++) {
                        let value = contentNodes.snapshotItem(j).textContent.trim();

                        //check if content has highlighted text, then replace it with markers
                        const highlightedContent = document.evaluate("./span[contains(@class, 'maudo')]", contentNodes.snapshotItem(j), null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                        if (highlightedContent.snapshotLength > 0) {
                            for (let k = 0; k < highlightedContent.snapshotLength; k++) {
                                const pattern = new RegExp(`\\b(${highlightedContent.snapshotItem(k).textContent.trim()})\\b`, 'gi');
                                value = value.replace(pattern, "(" + highlightedContent.snapshotItem(k).textContent.trim() + ")");
                            }
                        }

                        if (value) content.push(value);
                    }

                    // Add to extracted data
                    if(title){
                        extractedData.push({
                            id: currentId++,
                            title: title || `Match ${currentId}`,
                            content: content.length > 0 ? content : ['No odds available']
                        });
                    } 
                }

                return extractedData;
            } catch (error) {
                window.logToPopup(`Error extracting data: ${error.message}`);
                return [];
            }
        }

        /**
         * Updates the popup table with extracted data
         * @param {Array} data - Array of data sets
         * @param {HTMLElement} tbody - Table body element to update
         */
        function updateTableWithData(data, tbody) {
            try {
                window.logToPopup('Data Collector: Updating table with data...');
                console.log('data: ',data);
                // Clear existing table body
                tbody.innerHTML = '';
                // Process each data set
                data.forEach((dataSet) => {
                    let valueSet = [];
                    const totalRows = 1 + dataSet.content.length; // 1 title + N content

                    // Row 1: ID (rowspan), and Title
                    const trTitle = document.createElement('tr');

                    // ID column with rowspan
                    const idTd = document.createElement('td');
                    idTd.textContent = dataSet.id;
                    idTd.rowSpan = totalRows;
                    idTd.style.cssText = `
                        border: 1px solid #ccc;
                        padding: 4px;
                        text-align: center;
                        vertical-align: top;
                        word-wrap: break-word;
                        word-break: break-word;
                        min-width: 30px;
                    `;
                    trTitle.appendChild(idTd);

                    // Title cell
                    const titleTd = document.createElement('td');
                    let title = convertDateFormat(extractDate(dataSet.title))
                    valueSet.push(getUnixUTCTimestamp(extractDate(dataSet.title))); //add info into valueSet array for updating to Gooogle sheet later 
                    valueSet.push(title); //add info into valueSet array for updating to Gooogle sheet later 
                    titleTd.textContent = title;
                    titleTd.style.cssText = `
                        border: 1px solid #ccc;
                        padding: 4px;
                        text-align: left;
                        word-wrap: break-word;
                        word-break: break-word;
                        min-width: 200px;
                        font-weight: bold;
                    `;
                    trTitle.appendChild(titleTd);

                    tbody.appendChild(trTitle);

                    let contents =[]
                    // Add content rows (each one is its own row under the title)
                    dataSet.content.forEach((contentItem) => {
                        const trContent = document.createElement('tr');
                        const contentTd = document.createElement('td');
                        contentTd.textContent = contentItem;
                        contents.push(contentItem); //add info into values array for updating to Gooogle sheet later 
                        contentTd.style.cssText = `
                            border: 1px solid #ccc;
                            padding: 4px;
                            text-align: left;
                            word-wrap: break-word;
                            word-break: break-word;
                            min-width: 200px;
                        `;
                        trContent.appendChild(contentTd);
                        tbody.appendChild(trContent);
                    });
                    valueSet.push(contents.join(' ')); //convert all results to 1 single string
                    values.push(valueSet);
                });

                // Adjust popup width based on table content
                const table = tbody.closest('table');
                if (table) {
                    // Force a reflow to get accurate measurements
                    table.style.display = 'none';
                    table.offsetHeight; // Force reflow
                    table.style.display = '';

                    // Get the total width of all columns
                    const totalWidth = Array.from(table.querySelectorAll('th')).reduce((sum, th) => {
                        return sum + th.offsetWidth;
                    }, 0);

                    // Add padding and borders
                    const popup = document.getElementById('data-collector-popup');
                    if (popup) {
                        const padding = 20; // Account for popup padding
                        const borders = 2; // Account for borders
                        const newWidth = Math.min(Math.max(totalWidth + padding + borders, 300), window.innerWidth - 40);
                        
                        // Force a reflow before setting the new width
                        popup.offsetHeight;
                        popup.style.width = `${newWidth}px`;
                        
                        // Update original dimensions
                        originalWidth = newWidth;
                        originalHeight = popup.offsetHeight;
                        
                        window.logToPopup(`Popup width adjusted to ${newWidth}px`);
                    }
                }
            } catch (error) {
                window.logToPopup('Data Collector: Error in updateTableWithData:\n' + error);
            }
        }

        /**
         * Main refresh function - extracts and updates data
         * Also manages refresh interval based on results
         */
        async function refreshData() {
            try {
                window.logToPopup('Data Collector: Refreshing data...');
                const extractedData = await extractDataFromPage();
                updateTableWithData(extractedData, window.dataCollectorTbody);
                
                // Update interval based on data results
                if (extractedData.length === 0) {
                    window.dataCollectorInterval = 2;
                    window.logToPopup(`No data found. Changing refresh interval to 2s`);
                } else {
                    window.dataCollectorInterval = 30;
                    window.logToPopup(`Found ${extractedData.length} data sets. Changing refresh interval to 30s`);
                }
                
                window.logToPopup(`Successfully extracted ${extractedData.length} data sets at ${new Date().toLocaleTimeString()}`);
            } catch (error) {
                window.logToPopup(`Error extracting data: ${error.message}`);
            }
        }

        /**
         * Creates and initializes the floating popup
         * @returns {HTMLElement} - The created popup element
         */
        function createFloatingPopup() {
            try {
                console.log('Data Collector: Creating popup...');
                // Create main container
                const popup = document.createElement('div');
                popup.id = 'data-collector-popup';
                popup.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 20px;
                    width: 300px;
                    min-width: 200px;
                    max-width: calc(100vw - 40px);
                    max-height: calc(100vh - 40px);
                    background: #f0f8ff;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    will-change: transform;
                    box-sizing: border-box;
                    overflow: hidden;
                `;

                // Create header bar
                const header = document.createElement('div');
                header.style.cssText = `
                    padding: 8px;
                    background: linear-gradient(to right, #8B0000, #FF6B6B);
                    border-bottom: 1px solid #ccc;
                    cursor: move;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    user-select: none;
                    flex-shrink: 0;
                    box-sizing: border-box;
                    height: 40px;
                    line-height: 24px;
                    color: white;
                `;

                // Create title container
                const titleContainer = document.createElement('div');
                titleContainer.style.cssText = `
                    display: flex;
                    align-items: center;
                    min-width: 0;
                    flex: 1;
                    gap: 16px;
                `;

                // Create title
                const title = document.createElement('span');
                title.textContent = 'Data Collector';
                title.style.cssText = `
                    font-weight: bold;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    color: white;
                    flex-shrink: 0;
                `;

                // Create refresh indicator container
                const refreshContainer = document.createElement('div');
                refreshContainer.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                `;

                // Create refresh indicator
                const refreshIndicator = document.createElement('span');
                refreshIndicator.style.cssText = `
                    font-size: 12px;
                    color: #ccc;
                    min-width: 80px;
                    text-align: right;
                    cursor: pointer;
                    user-select: none;
                `;
                refreshIndicator.textContent = 'Auto-refresh in: 5s';

                // Create refresh button
                const refreshButton = document.createElement('button');
                refreshButton.innerHTML = '↻'; // Refresh symbol
                refreshButton.style.cssText = `
                    background: none;
                    border: none;
                    color: #ccc;
                    cursor: pointer;
                    font-size: 14px;
                    padding: 0 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.2s;
                `;
                refreshButton.title = 'Refresh now';

                // Add flashing animation style
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes flash {
                        0% { background: linear-gradient(to right, #8B0000, #FF6B6B); }
                        50% { background: linear-gradient(to right, #FF6B6B, #8B0000); }
                        100% { background: linear-gradient(to right, #8B0000, #FF6B6B); }
                    }
                    .flashing {
                        animation: flash 1s infinite;
                    }
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .spinning {
                        animation: spin 1s linear infinite;
                    }
                `;
                document.head.appendChild(style);

                // Create toggle button
                const toggleBtn = document.createElement('button');
                toggleBtn.textContent = '−';
                toggleBtn.style.cssText = `
                    border: none;
                    background: none;
                    cursor: pointer;
                    font-size: 16px;
                    padding: 0 5px;
                    flex-shrink: 0;
                    margin-left: 8px;
                    color: white;
                `;

                // Create content wrapper
                const contentWrapper = document.createElement('div');
                contentWrapper.style.cssText = `
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    overflow: hidden;
                    box-sizing: border-box;
                `;

                // Create main content container
                const mainContent = document.createElement('div');
                mainContent.style.cssText = `
                    flex: 1;
                    padding: 10px;
                    overflow-y: auto;
                    min-height: 0;
                    box-sizing: border-box;
                `;

                // Create table
                const table = document.createElement('table');
                table.style.cssText = `
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                    margin-bottom: 10px;
                    table-layout: auto;
                `;

                // Create table header
                const thead = document.createElement('thead');
                thead.innerHTML = `
                    <tr>
                        <th style="width: 5%; border: 1px solid #ccc; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 30px;">#</th>
                        <th style="width: 30%; border: 1px solid #ccc; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 100px;">Title</th>
                    </tr>
                `;
                table.appendChild(thead);

                // Create table body
                const tbody = document.createElement('tbody');
                table.appendChild(tbody);
                mainContent.appendChild(table);

                // Create log area
                const logArea = document.createElement('textarea');
                logArea.style.cssText = `
                    width: calc(100% - 20px);
                    height: 100px;
                    margin: 10px;
                    padding: 5px;
                    border: 1px solid #ccc;
                    resize: none;
                    box-sizing: border-box;
                    flex-shrink: 0;
                `;
                logArea.readOnly = true;

                // Create resize handle
                const resizeHandle = document.createElement('div');
                resizeHandle.style.cssText = `
                    position: absolute;
                    right: 0;
                    bottom: 0;
                    width: 10px;
                    height: 10px;
                    cursor: se-resize;
                    background: linear-gradient(135deg, transparent 50%, #ccc 50%);
                    z-index: 1;
                `;

                // Assemble the popup
                titleContainer.appendChild(title);
                titleContainer.appendChild(refreshContainer);
                header.appendChild(titleContainer);
                header.appendChild(toggleBtn);
                contentWrapper.appendChild(mainContent);
                contentWrapper.appendChild(logArea);
                popup.appendChild(header);
                popup.appendChild(contentWrapper);
                popup.appendChild(resizeHandle);

                // Add refresh button to container
                refreshContainer.appendChild(refreshIndicator);
                refreshContainer.appendChild(refreshButton);

                // Store original dimensions
                originalWidth = 300;
                originalHeight = popup.offsetHeight;

                // Make popup draggable
                let isDragging = false;
                let startX, startY;
                let startLeft, startTop;

                header.addEventListener('mousedown', (e) => {
                    if (e.target === header || e.target === title || e.target === titleContainer) {
                        isDragging = true;
                        startX = e.clientX;
                        startY = e.clientY;
                        const rect = popup.getBoundingClientRect();
                        startLeft = rect.left;
                        startTop = rect.top;
                        e.preventDefault();
                    }
                });

                document.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    
                    popup.style.left = `${startLeft + dx}px`;
                    popup.style.top = `${startTop + dy}px`;
                });

                document.addEventListener('mouseup', () => {
                    isDragging = false;
                });

                // Make popup resizable
                let isResizing = false;
                let startWidth, startHeight;

                resizeHandle.addEventListener('mousedown', (e) => {
                    isResizing = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startWidth = popup.offsetWidth;
                    startHeight = popup.offsetHeight;
                    e.preventDefault();
                });

                document.addEventListener('mousemove', (e) => {
                    if (!isResizing) return;

                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    
                    const newWidth = Math.max(200, startWidth + dx);
                    const newHeight = Math.max(150, startHeight + dy);
                    
                    popup.style.width = `${newWidth}px`;
                    popup.style.height = `${newHeight}px`;
                    
                    // Update original dimensions
                    originalWidth = newWidth;
                    originalHeight = newHeight;
                });

                document.addEventListener('mouseup', () => {
                    isResizing = false;
                });

                // Toggle popup size
                let isCollapsed = false;

                toggleBtn.addEventListener('click', () => {
                    isCollapsed = !isCollapsed;
                    if (isCollapsed) {
                        popup.style.height = '40px';
                        popup.style.width = '300px';
                        contentWrapper.style.display = 'none';
                        popup.style.minHeight = '40px';
                        popup.style.minWidth = '300px';
                        toggleBtn.textContent = '+';
                    } else {
                        popup.style.height = `${originalHeight}px`;
                        popup.style.width = `${originalWidth}px`;
                        popup.style.minHeight = '150px';
                        popup.style.minWidth = '200px';
                        contentWrapper.style.display = 'flex';
                        toggleBtn.textContent = '−';
                    }
                });

                // Add logging function
                window.logToPopup = function(message) {
                    const timestamp = new Date().toLocaleTimeString();
                    let logMessage = `[${timestamp}] ${message}\n`;
                    logArea.value += logMessage;
                    logArea.scrollTop = logArea.scrollHeight;
                    console.log(logMessage);
                };

                // Store tbody reference
                window.dataCollectorTbody = tbody;

                // Store references
                window.dataCollectorRefreshIndicator = refreshIndicator;
                window.dataCollectorRefreshButton = refreshButton;
                window.dataCollectorHeader = header;

                // Add click handler for refresh button
                refreshButton.addEventListener('click', () => {
                    try {
                        refreshButton.classList.add('spinning');
                        refreshData();
                        timeLeft = window.dataCollectorInterval;
                        window.dataCollectorRefreshIndicator.textContent = `Auto-refresh in: ${timeLeft}s`;
                        setTimeout(() => {
                            refreshButton.classList.remove('spinning');
                        }, 1000);
                        window.logToPopup('Manual refresh triggered');
                    } catch (error) {
                        window.logToPopup('Data Collector: Error in refresh button click:\n' + error);
                    }
                });

                // Add click handler for refresh indicator
                refreshIndicator.addEventListener('click', () => {
                    try {
                        if (isPaused) {
                            // Resume refresh and trigger immediate refresh
                            isPaused = false;
                            window.dataCollectorHeader.classList.remove('flashing');
                            refreshData(); // Immediate refresh
                            timeLeft = window.dataCollectorInterval;
                            window.dataCollectorRefreshIndicator.textContent = `Auto-refresh in: ${timeLeft}s`;
                            refreshButton.style.display = 'flex'; // Show refresh button
                            startRefreshInterval();
                            window.logToPopup('Auto-refresh resumed with immediate refresh');
                        } else {
                            // Pause refresh
                            isPaused = true;
                            window.dataCollectorHeader.classList.add('flashing');
                            window.dataCollectorRefreshIndicator.textContent = 'Auto-refresh is paused';
                            refreshButton.style.display = 'none'; // Hide refresh button
                            window.logToPopup('Auto-refresh paused');
                        }
                    } catch (error) {
                        window.logToPopup('Data Collector: Error in refresh indicator click:\n' + error);
                    }
                });

                // Initialize refresh button visibility
                refreshButton.style.display = 'flex';

                return popup;
            } catch (error) {
                console.error('Data Collector: Error in createFloatingPopup:', error);
                throw error;
            }
        }

        /**
         * Starts the auto-refresh interval
         * Manages countdown and refresh timing
         */
        function startRefreshInterval() {
            try {
                if (refreshIntervalId) {
                    clearInterval(refreshIntervalId);
                }
                
                refreshIntervalId = setInterval(() => {
                    if (!isPaused) {
                        timeLeft--;
                        if (timeLeft <= 0) {
                            refreshData();
                            timeLeft = window.dataCollectorInterval;
                        }
                        window.dataCollectorRefreshIndicator.textContent = `Auto-refresh in: ${timeLeft}s`;
                    }
                }, 1000);
            } catch (error) {
                window.logToPopup('Data Collector: Error in startRefreshInterval:\n' + error);
            }
        }

        // Load gapi and init
        function gapiLoaded() {
            gapi.load('client', initializeGapiClient);
        }

        async function initializeGapiClient() {
            await gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: DISCOVERY_DOCS,
            });
            gapiInited = true;
        }

        // Hàm cập nhật Google Sheet
        async function updateSheetViaAPI(values) {

            const body = {
                values: values,
            };

            try {
                const response = await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: spreadsheetId,
                    range: range,
                    valueInputOption: valueInputOption,
                    resource: body,
                });
                console.log('Cells updated:', response);
            } catch (err) {
                console.error('Error updating sheet:', err);
            }
        }

        async function updateSheet(values) {
            console.log('values: ',values);
            writeToSheet(values, "mb");
        }
         /**
         * Ghi dữ liệu vào Google Sheet
         * @param {Object} valuesArray - Dữ liệu dạng object, ví dụ: { name: "Nguyễn", score: 95 }
         * @param {String} sheetName - Tên sheet được ghi
         */
        function writeToSheet(rows, sheetName = "Sheet1") {
            console.log(`✅ Bắt đầu ghi vào sheet ${sheetName}`);
            if (!Array.isArray(rows) || !Array.isArray(rows[0])) {
              console.error("❌ Dữ liệu sai định dạng! Cần mảng 2 chiều.");
              return;
            }
            let url = SHEET_API_BASE_URL;
            const params = [`action=write`];
            if (sheetName) params.push(`sheet=${encodeURIComponent(sheetName)}`);
            url += `?${params.join("&")}`;
          
            GM_xmlhttpRequest({
              method: "POST",
              url: url,
              headers: {
                "Content-Type": "application/json"
              },
              data: JSON.stringify({
                values: rows
              }),
              onload: function (response) {
                try {
                  const result = JSON.parse(response.responseText);
                  if (result.status === "success") {
                    console.log(`✅ Đã ghi ${result.rows_written} dòng vào sheet ${sheetName}`);
                  } else {
                    console.error("❌ Ghi lỗi:", result.message);
                  }
                } catch (err) {
                  console.error("❌ Lỗi khi parse kết quả:", err);
                }
              },
              onerror: function (err) {
                console.error("❌ Lỗi gọi API ghi dữ liệu:", err);
              }
            });
        }                  

        /**
         * Đọc dữ liệu từ Google Sheet qua Apps Script
         * @param {string} sheetName - Tên sheet cần đọc (bắt buộc nếu dùng range)
         * @param {string} range - Phạm vi cần đọc (ví dụ: "A2:D5")
         * @returns {Promise<any>} Dữ liệu JSON từ Apps Script
         */
        function readFromSheet(sheetName = "", range = "") {
            console.log(`✅ Bắt đầu đọc Dữ liệu từ Sheet: ${sheetName}!${range}`);
            // Tạo URL với tham số nếu có
            let url = SHEET_API_BASE_URL;
            const params = [`action=read`, `sheet=${encodeURIComponent(sheetName)}`, `range=${encodeURIComponent(range)}`];
            if (sheetName) params.push(`sheet=${encodeURIComponent(sheetName)}`);
            url += `?${params.join("&")}`;

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    onload: function (response) {
                        try {
                            const data = JSON.parse(response.responseText);
                            console.log("✅ Dữ liệu đọc được từ Sheet:", data);
                            resolve(data);
                        } catch (err) {
                            console.error("❌ Lỗi parse dữ liệu:", err);
                            reject(err);
                        }
                    },
                    onerror: function (err) {
                        console.error("❌ Lỗi fetch Sheet:", err);
                        reject(err);
                    }
                });
            });
        }  

        function getExtremeValueFromSheet(sheetName = "", columnName = "A", type = "max") {
            console.log(`📌 Bắt đầu lấy Giá trị ${type} từ cột ${columnName} của sheet ${sheetName}`);
            // Tạo URL với tham số truy vấn
            let url = SHEET_API_BASE_URL;
            const params = [`action=extreme`, `column=${encodeURIComponent(columnName)}`, `type=${encodeURIComponent(type)}`];
            if (sheetName) params.push(`sheet=${encodeURIComponent(sheetName)}`);
            url += `?${params.join("&")}`;
        
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    onload: function (response) {
                        try {
                            const result = JSON.parse(response.responseText);
                            if (result.error) {
                                console.error("❌ Lỗi từ server:", result.error);
                                reject(new Error(result.error));
                            } else {
                                console.log(`📌 Giá trị ${type}:`, result.value);
                                resolve(result.value);
                            }
                        } catch (err) {
                            console.error("❌ Lỗi parse dữ liệu:", err);
                            reject(err);
                        }
                    },
                    onerror: function (err) {
                        console.error("❌ Lỗi fetch extreme value:", err);
                        reject(err);
                    }
                });
            });
        }        

        async function triggerDataScanning(){

            const currentTimestamp = getCurrentUnixTimestamp();

             //start scanning the page
             console.log('Data Collector: Page loaded, initializing...');
             console.log('Data Collector: Scanning the page at: ', currentTimestamp);
             const popup = createFloatingPopup();
             document.body.appendChild(popup);
             window.logToPopup('Data Collector initialized');

             // Initial data extraction
             return refreshData();
        }

        function triggerUpdateSequence(){
            // Start initial interval
            startRefreshInterval();

            // Clean up interval when popup is closed
            window.addEventListener('unload', () => {
                if (refreshIntervalId) {
                    clearInterval(refreshIntervalId);
                }
            });

            //update all found data to Google sheet
             updateSheet(values);
        }
        
        // Initialize popup when page loads
        window.addEventListener('load', async () => {
            try {

                // gapiLoaded();

                // // Init Google Identity Services
                // tokenClient = google.accounts.oauth2.initTokenClient({
                //     client_id: CLIENT_ID,
                //     scope: SCOPES,
                //     callback: '', // set in requestAccessToken
                // });
                // tokenClient.callback = async (resp) => {
                //     if (resp.error !== undefined) {
                //       throw resp;
                //     }
                //     console.log('Successfully authorized!');
                //   };
                
                // tokenClient.requestAccessToken({ prompt: 'consent' });

                getExtremeValueFromSheet("mb", "A", "min")
                    .then(value => {
                        console.log("📈 Giá trị nhỏ nhất cột:", value);
                        console.log("📈 Ngày nhỏ nhất cột:", formatDateFromTimestamp(value));
                        minDateTimestamp = value;

                        getExtremeValueFromSheet("mb", "A", "max")
                            .then(value => {
                                console.log("📈 Giá trị lớn nhất cột:", value);
                                console.log("📈 Ngày lớn nhất cột:", formatDateFromTimestamp(value));
                                maxDateTimestamp = value;
                                if ((minDateTimestamp == 'NaN' && maxDateTimestamp == 'NaN') || (getUnixUTCTimestamp(getTodayDate()) - maxDateTimestamp > 0)) {
                                    if(maxDateTimestamp == 'NaN'){
                                        console.log("📈 Ngày lớn nhất đang bỏ trống");
                                    } else {
                                        console.log("📈 Ngày lớn nhất chưa phải là ngày hiện tại", formatDateFromTimestamp(maxDateTimestamp));
                                    }
                                    
                                    executePreExtractionSnippet(getTodayDate()).then(result =>{
                                        if(result){
                                            throw STOP_EXECUTION;
                                        } else {
                                            triggerDataScanning().then(value => {
                                                triggerUpdateSequence();
                                            });
                                        }
                                    }).catch(error => {
                                        // Xử lý lỗi nếu Promise bị từ chối (rejected)
                                        if (error === STOP_EXECUTION) {
                                            console.log(`Thread was terminated gracefully!`);
                                        } else {
                                            console.error("Đã có lỗi xảy ra:", error);
                                        }
                                    });
                                } else {
                                    executePreExtractionSnippet(offsetDate(formatDateFromTimestamp(minDateTimestamp), -1)).then(result =>{
                                        if(result){
                                            throw STOP_EXECUTION;
                                        } else {
                                            triggerDataScanning().then(value => {
                                                triggerUpdateSequence();
                                            });
                                        }
                                    }).catch(error => {
                                        // Xử lý lỗi nếu Promise bị từ chối (rejected)
                                        if (error === STOP_EXECUTION) {
                                            console.log(`Thread was terminated gracefully!`);
                                        } else {
                                            console.error("Đã có lỗi xảy ra:", error);
                                        }
                                    });
                                }
                            })   
                            .catch(err => {
                                if (err === STOP_EXECUTION) {
                                    console.log(`Thread was terminated gracefully!`);
                                } else {
                                    console.error("❌ Lỗi khi lấy giá trị:", err);
                                }
                            });
                    })
                    .catch(err => {
                        console.error("❌ Lỗi khi lấy giá trị:", err);
                    });

                // // Đọc từ sheet "chat" và vùng A2:D5
                // readFromSheet("mb", "A2:D")
                //     .then(data => console.log("📋 Dữ liệu:", data))
                //     .catch(err => console.error("❌ Lỗi:", err));
                
            } catch (error) {
                console.error('Data Collector: Error in initialization:', error);
            }
        });

        console.log('Data Collector: Script loaded successfully');
    } catch (error) {
        console.error('Data Collector: Fatal error in script:', error);
    }
})();