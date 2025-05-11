// Tamper Monkey Script
// ==UserScript==
// @name         Get Odds
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Simply get the odds
// @author       Viet Cat
// @match        https://*.viva88.com/*
// @grant        none
// ==/UserScript==

/**
 * Main script function - wrapped in IIFE for scope isolation
 * This script creates a floating popup to collect and display betting odds
 * Features:
 * - Auto-refresh with dynamic intervals (5s default, 2s if no matches, 30s if matches found)
 * - Manual refresh with visual feedback
 * - Pause/resume functionality
 * - Draggable and resizable popup
 * - Collapsible interface
 */
(function() {
    'use strict';

    try {
        console.log('Odds Collector: Script starting...');

        // Global variables for refresh functionality
        let timeLeft = 5;                    // Countdown timer
        let refreshIntervalId = null;        // Stores interval ID for cleanup
        let isPaused = false;                // Tracks pause state
        window.oddsCollectorInterval = 5;    // Default refresh interval
        let originalWidth = 300;             // Store original popup width
        let originalHeight = 0;              // Store original popup height

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
                console.error('Odds Collector: Error in getTextContent:', error);
                return '';
            }
        }

        /**
         * Extracts betting odds data from the page using XPath
         * @returns {Array} - Array of match data with odds
         */
        function extractDataFromPage() {
            try {
                console.log('Odds Collector: Starting data extraction...');
                // Main XPath for finding match components
                const mainXPath = "//div[@id='mainArea']/div[contains(@class, 'odds')]/div[contains(@class, 'c-odds-table')]/div[contains(@class, 'c-league')]/div[contains(@class, 'c-match-group')]/div[contains(@class, 'c-match')]/div[contains(@class, 'bets')]/div[contains(@class, 'odds-group')]";
                
                // XPath for finding odds groups within a match
                const oddsGroupXPath = "./div[contains(@class, 'odds')]";
                
                // XPath expressions for different data types
                const xpathExpressions = {
                    matchInfo: {
                        teamA: "./div[contains(@class, 'odds')][1]/div[contains(@class, 'event')]/div[contains(@class, 'team')][1]//text()",
                        teamB: "./div[contains(@class, 'odds')][1]/div[contains(@class, 'event')]/div[contains(@class, 'team')][2]//text()",
                        time: "parent::div/preceding-sibling::div[contains(@class, 'mathch-header')]/div[contains(@class, 'row-title')]/div[contains(@class, 'info')]//text()"
                    },
                    matchOdd: {
                        handicapA: "./div[contains(@class, 'bettype-col')][1]/div[contains(@class, 'odds-button')][1]/span[contains(@class, 'text-goal')]//text()",
                        teamAodd: "./div[contains(@class, 'bettype-col')][1]/div[contains(@class, 'odds-button')][1]/span[contains(@class, 'odds')]//text()",
                        handicapB: "./div[contains(@class, 'bettype-col')][1]/div[contains(@class, 'odds-button')][2]/span[contains(@class, 'text-goal')]//text()",
                        teamBodd: "./div[contains(@class, 'bettype-col')][1]/div[contains(@class, 'odds-button')][2]/span[contains(@class, 'odds')]//text()"
                    },
                    odds1X2: {
                        teamAodd: "./div[contains(@class, 'bettype-col')][3]/div[contains(@class, 'odds-button')][1]/span[contains(@class, 'odds')]//text()",
                        teamBodd: "./div[contains(@class, 'bettype-col')][3]/div[contains(@class, 'odds-button')][2]/span[contains(@class, 'odds')]//text()",
                        draw: "./div[contains(@class, 'bettype-col')][3]/div[contains(@class, 'odds-button')][3]/span[contains(@class, 'odds')]//text()"
                    },
                    overUnder: {
                        handicapA: "./div[contains(@class, 'bettype-col')][2]/div[contains(@class, 'odds-button')][1]/span[contains(@class, 'text-goal')]//text()",
                        teamAodd: "./div[contains(@class, 'bettype-col')][2]/div[contains(@class, 'odds-button')][1]/span[contains(@class, 'odds')]//text()",
                        handicapB: "./div[contains(@class, 'bettype-col')][2]/div[contains(@class, 'odds-button')][2]/span[contains(@class, 'text-goal')]//text()",
                        teamBodd: "./div[contains(@class, 'bettype-col')][2]/div[contains(@class, 'odds-button')][2]/span[contains(@class, 'odds')]//text()"
                    }
                };

                // Get all match components
                const matches = document.evaluate(mainXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                const extractedData = [];
                let currentId = 1;

                // Process each match
                for (let i = 0; i < matches.snapshotLength; i++) {
                    const match = matches.snapshotItem(i);
                    
                    // Get team names and time once per match
                    const teamA = getTextContent(xpathExpressions.matchInfo.teamA, match);
                    const teamB = getTextContent(xpathExpressions.matchInfo.teamB, match);
                    const matchTime = getTextContent(xpathExpressions.matchInfo.time, match);
                    
                    // Initialize blocks with empty details arrays
                    const matchInfo = {
                        name: "Kèo trận",
                        detailNames: ["EV", "Mốc kèo", teamA, teamB],
                        details: []
                    };

                    const overUnder = {
                        name: "Kèo Tài Xỉu",
                        detailNames: ["EV", "Mốc kèo", "Tài", "Xỉu"],
                        details: []
                    };

                    const odds1X2 = {
                        name: "Kèo 1X2",
                        detailNames: ["EV", teamA, teamB, "Hoà"],
                        details: []
                    };

                    // Get all odds groups for this match
                    const oddsGroups = document.evaluate(oddsGroupXPath, match, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    
                    // Process each odds group
                    for (let j = 0; j < oddsGroups.snapshotLength; j++) {
                        const oddsGroup = oddsGroups.snapshotItem(j);
                        
                        // Extract and add match odds
                        matchInfo.details.push([
                            "-EV-",
                            getTextContent(xpathExpressions.matchOdd.handicapA, oddsGroup),
                            getTextContent(xpathExpressions.matchOdd.teamAodd, oddsGroup),
                            getTextContent(xpathExpressions.matchOdd.teamBodd, oddsGroup)
                        ]);

                        // Extract and add over/under odds
                        overUnder.details.push([
                            "-EV-",
                            getTextContent(xpathExpressions.overUnder.handicapA, oddsGroup),
                            getTextContent(xpathExpressions.overUnder.teamAodd, oddsGroup),
                            getTextContent(xpathExpressions.overUnder.teamBodd, oddsGroup)
                        ]);

                        // Extract and add 1X2 odds
                        odds1X2.details.push([
                            "-EV-",
                            getTextContent(xpathExpressions.odds1X2.teamAodd, oddsGroup),
                            getTextContent(xpathExpressions.odds1X2.teamBodd, oddsGroup),
                            getTextContent(xpathExpressions.odds1X2.draw, oddsGroup)
                        ]);
                    }

                    // Add to extracted data
                    extractedData.push({
                        id: currentId++,
                        blocks: [matchInfo, overUnder, odds1X2]
                    });
                }

                return extractedData;
            } catch (error) {
                console.error('Odds Collector: Error in extractDataFromPage:', error);
                return [];
            }
        }

        /**
         * Updates the popup table with extracted data
         * @param {Array} data - Array of match data
         * @param {HTMLElement} tbody - Table body element to update
         */
        function updateTableWithData(data, tbody) {
            try {
                console.log('Odds Collector: Updating table with data...');
                // Clear existing table body
                tbody.innerHTML = '';
                
                // Process each entity
                data.forEach((entity, entityIndex) => {
                    // Calculate total rows for this entity (block name + detail names + all detail rows)
                    const maxDetails = Math.max(...entity.blocks.map(block => block.details.length));
                    const totalRows = 2 + maxDetails; // 2 for block name and detail names rows
                    
                    // Create rows for this entity
                    for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
                        const tr = document.createElement('tr');
                        
                        // Add order number (merged cell)
                        if (rowIndex === 0) {
                            const td = document.createElement('td');
                            td.textContent = entity.id;
                            td.style.cssText = `
                                border: 1px solid #ccc;
                                padding: 4px;
                                text-align: center;
                                vertical-align: middle;
                                word-wrap: break-word;
                                word-break: break-word;
                                min-width: 30px;
                            `;
                            td.rowSpan = totalRows;
                            tr.appendChild(td);
                        }

                        // Add blocks
                        entity.blocks.forEach((block, blockIndex) => {
                            if (rowIndex === 0) {
                                // Block name row
                                const td = document.createElement('td');
                                td.textContent = block.name;
                                td.style.cssText = `
                                    border: 1px solid #ccc;
                                    padding: 4px;
                                    text-align: center;
                                    background-color: #f8f9fa;
                                    font-weight: bold;
                                    word-wrap: break-word;
                                    word-break: break-word;
                                    min-width: 80px;
                                `;
                                td.colSpan = 4;
                                tr.appendChild(td);
                            } else if (rowIndex === 1) {
                                // Detail names row
                                block.detailNames.forEach(name => {
                                    const td = document.createElement('td');
                                    td.textContent = name;
                                    td.style.cssText = `
                                        border: 1px solid #ccc;
                                        padding: 4px;
                                        text-align: center;
                                        background-color: #f8f9fa;
                                        word-wrap: break-word;
                                        word-break: break-word;
                                        min-width: 60px;
                                    `;
                                    tr.appendChild(td);
                                });
                            } else {
                                // Detail values rows
                                const detailIndex = rowIndex - 2;
                                const details = block.details[detailIndex] || ['', '', '', ''];
                                details.forEach(value => {
                                    const td = document.createElement('td');
                                    td.textContent = value;
                                    td.style.cssText = `
                                        border: 1px solid #ccc;
                                        padding: 4px;
                                        text-align: center;
                                        word-wrap: break-word;
                                        word-break: break-word;
                                        min-width: 60px;
                                    `;
                                    tr.appendChild(td);
                                });
                            }
                        });

                        // Add empty column for future use
                        if (rowIndex === 0) {
                            const td = document.createElement('td');
                            td.style.cssText = `
                                border: 1px solid #ccc;
                                padding: 4px;
                                min-width: 30px;
                            `;
                            td.rowSpan = totalRows;
                            tr.appendChild(td);
                        }

                        tbody.appendChild(tr);
                    }
                });

                // Calculate and set popup width based on table content
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
                    const popup = document.getElementById('odds-collector-popup');
                    if (popup) {
                        const padding = 20; // Account for popup padding
                        const borders = 2; // Account for borders
                        const newWidth = Math.min(Math.max(totalWidth + padding + borders, 300), window.innerWidth - 40);
                        
                        // Force a reflow before setting the new width
                        popup.offsetHeight;
                        popup.style.width = `${newWidth}px`;
                        
                        // Update original dimensions to store latest size
                        originalWidth = newWidth;
                        originalHeight = popup.offsetHeight;
                        
                        // Log the width change
                        window.logToPopup(`Popup width adjusted to ${newWidth}px`);
                    }
                }
            } catch (error) {
                console.error('Odds Collector: Error in updateTableWithData:', error);
            }
        }

        /**
         * Main refresh function - extracts and updates data
         * Also manages refresh interval based on results
         */
        function refreshData() {
            try {
                console.log('Odds Collector: Refreshing data...');
                const extractedData = extractDataFromPage();
                updateTableWithData(extractedData, window.oddsCollectorTbody);
                
                // Update interval based on match results
                if (extractedData.length === 0) {
                    window.oddsCollectorInterval = 2;
                    window.logToPopup(`No matches found. Changing refresh interval to 2s`);
                } else {
                    window.oddsCollectorInterval = 30;
                    window.logToPopup(`Found ${extractedData.length} matches. Changing refresh interval to 30s`);
                }
                
                window.logToPopup(`Successfully extracted ${extractedData.length} matches at ${new Date().toLocaleTimeString()}`);
            } catch (error) {
                console.error('Odds Collector: Error in refreshData:', error);
                window.logToPopup(`Error extracting data: ${error.message}`);
            }
        }

        /**
         * Creates and initializes the floating popup
         * @returns {HTMLElement} - The created popup element
         */
        function createFloatingPopup() {
            try {
                console.log('Odds Collector: Creating popup...');
                // Create main container
                const popup = document.createElement('div');
                popup.id = 'odds-collector-popup';
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
                title.textContent = 'Odds Collector';
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
                        <th colspan="4" style="border: 1px solid #ccc; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 80px;"></th>
                        <th colspan="4" style="border: 1px solid #ccc; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 80px;"></th>
                        <th colspan="4" style="border: 1px solid #ccc; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 80px;"></th>
                        <th style="width: 5%; border: 1px solid #ccc; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 30px;"></th>
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
                const headerHeight = header.offsetHeight;

                // Make popup draggable with improved performance
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
                    
                    // Update original dimensions when resizing
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
                        popup.style.height = '40px'; // Fixed header height
                        popup.style.width = '300px'; // Increased width by 25% (240px * 1.25)
                        contentWrapper.style.display = 'none';
                        popup.style.minHeight = '40px';
                        popup.style.minWidth = '300px'; // Increased min-width by 25%
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
                    logArea.value += `[${timestamp}] ${message}\n`;
                    logArea.scrollTop = logArea.scrollHeight;
                };

                // Store tbody reference for later use
                window.oddsCollectorTbody = tbody;

                // Store references
                window.oddsCollectorRefreshIndicator = refreshIndicator;
                window.oddsCollectorRefreshButton = refreshButton;
                window.oddsCollectorHeader = header;

                // Add click handler for refresh button
                refreshButton.addEventListener('click', () => {
                    try {
                        refreshButton.classList.add('spinning');
                        refreshData();
                        timeLeft = window.oddsCollectorInterval;
                        window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${timeLeft}s`;
                        setTimeout(() => {
                            refreshButton.classList.remove('spinning');
                        }, 1000);
                        window.logToPopup('Manual refresh triggered');
                    } catch (error) {
                        console.error('Odds Collector: Error in refresh button click:', error);
                    }
                });

                // Add click handler for refresh indicator
                refreshIndicator.addEventListener('click', () => {
                    try {
                        if (isPaused) {
                            // Resume refresh and trigger immediate refresh
                            isPaused = false;
                            window.oddsCollectorHeader.classList.remove('flashing');
                            refreshData(); // Immediate refresh
                            timeLeft = window.oddsCollectorInterval;
                            window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${timeLeft}s`;
                            refreshButton.style.display = 'flex'; // Show refresh button
                            startRefreshInterval();
                            window.logToPopup('Auto-refresh resumed with immediate refresh');
                        } else {
                            // Pause refresh
                            isPaused = true;
                            window.oddsCollectorHeader.classList.add('flashing');
                            window.oddsCollectorRefreshIndicator.textContent = 'Auto-refresh is paused';
                            refreshButton.style.display = 'none'; // Hide refresh button
                            window.logToPopup('Auto-refresh paused');
                        }
                    } catch (error) {
                        console.error('Odds Collector: Error in refresh indicator click:', error);
                    }
                });

                // Initialize refresh button visibility
                refreshButton.style.display = 'flex';

                return popup;
            } catch (error) {
                console.error('Odds Collector: Error in createFloatingPopup:', error);
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
                            timeLeft = window.oddsCollectorInterval;
                        }
                        window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${timeLeft}s`;
                    }
                }, 1000);
            } catch (error) {
                console.error('Odds Collector: Error in startRefreshInterval:', error);
            }
        }

        // Initialize popup when page loads
        window.addEventListener('load', () => {
            try {
                console.log('Odds Collector: Page loaded, initializing...');
                const popup = createFloatingPopup();
                document.body.appendChild(popup);
                window.logToPopup('Odds Collector initialized');
                
                // Initial data extraction
                refreshData();

                // Start initial interval
                startRefreshInterval();

                // Clean up interval when popup is closed
                window.addEventListener('unload', () => {
                    if (refreshIntervalId) {
                        clearInterval(refreshIntervalId);
                    }
                });
            } catch (error) {
                console.error('Odds Collector: Error in initialization:', error);
            }
        });

        console.log('Odds Collector: Script loaded successfully');
    } catch (error) {
        console.error('Odds Collector: Fatal error in script:', error);
    }
})();