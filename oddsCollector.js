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
            min-height: 150px;
            background: #f0f8ff;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            will-change: transform;
            box-sizing: border-box;
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
        `;

        // Create table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th style="width: 5%; border: 1px solid #ccc; padding: 4px;">#</th>
                <th colspan="4" style="border: 1px solid #ccc; padding: 4px;">Block 1</th>
                <th colspan="4" style="border: 1px solid #ccc; padding: 4px;">Block 2</th>
                <th colspan="4" style="border: 1px solid #ccc; padding: 4px;">Block 3</th>
                <th style="width: 5%; border: 1px solid #ccc; padding: 4px;"></th>
            </tr>
        `;
        table.appendChild(thead);

        // Create table body
        const tbody = document.createElement('tbody');
        
        // Process each entity
        sampleData.forEach((entity, entityIndex) => {
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
                    `;
                    td.rowSpan = totalRows;
                    tr.appendChild(td);
                }

                tbody.appendChild(tr);
            }
        });

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

        return popup;
    }

    // Initialize popup when page loads
    window.addEventListener('load', () => {
        const popup = createFloatingPopup();
        window.logToPopup('Odds Collector initialized');
    });
})();