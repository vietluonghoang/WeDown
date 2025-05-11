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

(function() {
    'use strict';

    // Sample data structure
    const sampleData = [
        {
            id: 1,
            blocks: [
                {
                    name: "Match Info",
                    detailNames: ["Team A", "Team B", "Time", "League"],
                    details: [
                        ["Liverpool", "Man City", "20:00", "Premier League"],
                        ["Arsenal", "Chelsea", "21:00", "Premier League"],
                        ["Man Utd", "Tottenham", "22:00", "Premier League"]
                    ]
                },
                {
                    name: "1X2 Odds",
                    detailNames: ["1", "X", "2", "Time"],
                    details: [
                        ["1.85", "3.40", "4.20", "20:00"],
                        ["2.10", "3.20", "3.50", "21:00"],
                        ["1.95", "3.30", "4.00", "22:00"]
                    ]
                },
                {
                    name: "Over/Under",
                    detailNames: ["Over", "Line", "Under", "Time"],
                    details: [
                        ["1.90", "2.5", "1.95", "20:00"],
                        ["1.85", "3.0", "2.00", "21:00"],
                        ["1.95", "2.0", "1.90", "22:00"]
                    ]
                }
            ]
        },
        {
            id: 2,
            blocks: [
                {
                    name: "Match Info",
                    detailNames: ["Team A", "Team B", "Time", "League"],
                    details: [
                        ["Barcelona", "Real Madrid", "20:30", "La Liga"],
                        ["Atletico", "Sevilla", "21:30", "La Liga"]
                    ]
                },
                {
                    name: "1X2 Odds",
                    detailNames: ["1", "X", "2", "Time"],
                    details: [
                        ["2.20", "3.30", "3.20", "20:30"],
                        ["1.75", "3.50", "4.50", "21:30"]
                    ]
                },
                {
                    name: "Over/Under",
                    detailNames: ["Over", "Line", "Under", "Time"],
                    details: [
                        ["1.95", "2.5", "1.90", "20:30"],
                        ["2.05", "3.0", "1.80", "21:30"]
                    ]
                }
            ]
        }
    ];

    // Function to extract data from page using XPath
    function extractDataFromPage() {
        // Main XPath for finding match components
        const mainXPath = "//div[@id='mainArea']/div[contains(@class, 'odds')]/div[contains(@class, 'c-odds-table')]/div[contains(@class, 'c-league')]/div[contains(@class, 'c-match-group')]/div[contains(@class, 'c-match')]";
        
        // XPath expressions for different data types
        const xpathExpressions = {
            matchInfo: {
                teamA: ".//div[contains(@class, 'team-home')]//text()",
                teamB: ".//div[contains(@class, 'team-away')]//text()",
                time: ".//div[contains(@class, 'match-time')]//text()",
                league: "ancestor::div[contains(@class, 'c-league')]//div[contains(@class, 'league-name')]//text()"
            },
            odds1X2: {
                home: ".//div[contains(@class, 'odds-1x2')]//div[contains(@class, 'home')]//text()",
                draw: ".//div[contains(@class, 'odds-1x2')]//div[contains(@class, 'draw')]//text()",
                away: ".//div[contains(@class, 'odds-1x2')]//div[contains(@class, 'away')]//text()"
            },
            overUnder: {
                over: ".//div[contains(@class, 'odds-ou')]//div[contains(@class, 'over')]//text()",
                line: ".//div[contains(@class, 'odds-ou')]//div[contains(@class, 'line')]//text()",
                under: ".//div[contains(@class, 'odds-ou')]//div[contains(@class, 'under')]//text()"
            }
        };

        // Function to evaluate XPath and get text content
        function getTextContent(xpath, context) {
            const result = document.evaluate(xpath, context, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            let text = '';
            for (let i = 0; i < result.snapshotLength; i++) {
                text += result.snapshotItem(i).textContent.trim();
            }
            return text.trim();
        }

        // Get all match components
        const matches = document.evaluate(mainXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const extractedData = [];
        let currentId = 1;

        // Process each match
        for (let i = 0; i < matches.snapshotLength; i++) {
            const match = matches.snapshotItem(i);
            
            // Extract match info
            const matchInfo = {
                name: "Match Info",
                detailNames: ["Team A", "Team B", "Time", "League"],
                details: [[
                    getTextContent(xpathExpressions.matchInfo.teamA, match),
                    getTextContent(xpathExpressions.matchInfo.teamB, match),
                    getTextContent(xpathExpressions.matchInfo.time, match),
                    getTextContent(xpathExpressions.matchInfo.league, match)
                ]]
            };

            // Extract 1X2 odds
            const odds1X2 = {
                name: "1X2 Odds",
                detailNames: ["1", "X", "2", "Time"],
                details: [[
                    getTextContent(xpathExpressions.odds1X2.home, match),
                    getTextContent(xpathExpressions.odds1X2.draw, match),
                    getTextContent(xpathExpressions.odds1X2.away, match),
                    getTextContent(xpathExpressions.matchInfo.time, match)
                ]]
            };

            // Extract Over/Under odds
            const overUnder = {
                name: "Over/Under",
                detailNames: ["Over", "Line", "Under", "Time"],
                details: [[
                    getTextContent(xpathExpressions.overUnder.over, match),
                    getTextContent(xpathExpressions.overUnder.line, match),
                    getTextContent(xpathExpressions.overUnder.under, match),
                    getTextContent(xpathExpressions.matchInfo.time, match)
                ]]
            };

            // Add to extracted data
            extractedData.push({
                id: currentId++,
                blocks: [matchInfo, odds1X2, overUnder]
            });
        }

        return extractedData;
    }

    // Function to update table with data
    function updateTableWithData(data, tbody) {
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
                
                // Log the width change
                window.logToPopup(`Popup width adjusted to ${newWidth}px`);
            }
        }
    }

    // Function to refresh data
    function refreshData() {
        try {
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
            window.logToPopup(`Error extracting data: ${error.message}`);
        }
    }

    // Create and initialize the floating popup
    function createFloatingPopup() {
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
            height: 24px;
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
        `;

        // Create refresh indicator
        const refreshIndicator = document.createElement('span');
        refreshIndicator.style.cssText = `
            margin-left: 8px;
            font-size: 12px;
            color: #ccc;
            min-width: 80px;
            text-align: right;
        `;
        refreshIndicator.textContent = 'Auto-refresh in: 5s';

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
                <th colspan="4" style="border: 1px solid #ccc; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 80px;">Block 1</th>
                <th colspan="4" style="border: 1px solid #ccc; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 80px;">Block 2</th>
                <th colspan="4" style="border: 1px solid #ccc; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 80px;">Block 3</th>
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
        titleContainer.appendChild(refreshIndicator);
        header.appendChild(titleContainer);
        header.appendChild(toggleBtn);
        contentWrapper.appendChild(mainContent);
        contentWrapper.appendChild(logArea);
        popup.appendChild(header);
        popup.appendChild(contentWrapper);
        popup.appendChild(resizeHandle);
        document.body.appendChild(popup);

        // Store original dimensions
        let originalWidth = 300;
        let originalHeight = popup.offsetHeight;
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
                popup.style.height = `${headerHeight}px`;
                popup.style.width = `${headerHeight * 3}px`;
                contentWrapper.style.display = 'none';
                popup.style.minHeight = '0';
                toggleBtn.textContent = '+';
            } else {
                popup.style.height = `${originalHeight}px`;
                popup.style.width = `${originalWidth}px`;
                popup.style.minHeight = '150px';
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

        // Store refresh indicator reference
        window.oddsCollectorRefreshIndicator = refreshIndicator;

        return popup;
    }

    // Initialize popup when page loads
    window.addEventListener('load', () => {
        const popup = createFloatingPopup();
        window.logToPopup('Odds Collector initialized');
        
        // Initial data extraction
        refreshData();

        // Set up auto-refresh with countdown
        let timeLeft = 5;
        window.oddsCollectorInterval = 5; // Default interval

        const refreshInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                refreshData();
                timeLeft = window.oddsCollectorInterval;
            }
            window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${timeLeft}s`;
        }, 1000);

        // Clean up interval when popup is closed
        window.addEventListener('unload', () => {
            clearInterval(refreshInterval);
        });
    });
})();