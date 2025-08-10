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

        // ==================== CONSTANTS ====================
        const CONSTANTS = {
            REFRESH: {
                DEFAULT_INTERVAL: 5,
                NO_MATCHES_INTERVAL: 2,
                MATCHES_FOUND_INTERVAL: 30
            },
            POPUP: {
                DEFAULT_WIDTH: 300,
                MIN_WIDTH: 200,
                MIN_HEIGHT: 150,
                HEADER_HEIGHT: 40,
                PADDING: 20,
                BORDER_WIDTH: 2,
                MARGIN_FROM_EDGE: 40
            },
            COLORS: {
                HEADER_GRADIENT_START: '#8B0000',
                HEADER_GRADIENT_END: '#FF6B6B',
                BACKGROUND: '#f0f8ff',
                BORDER: '#ccc',
                HIGHLIGHT: '#ffffe0',
                HEADER_BACKGROUND: '#f8f9fa'
            },
            ANIMATIONS: {
                FLASH_DURATION: 1000,
                SPIN_DURATION: 1000
            }
        };

        // ==================== STATE MANAGEMENT ====================
        const state = {
            timeLeft: CONSTANTS.REFRESH.DEFAULT_INTERVAL,
            refreshIntervalId: null,
            isPaused: false,
            currentInterval: CONSTANTS.REFRESH.DEFAULT_INTERVAL,
            originalWidth: CONSTANTS.POPUP.DEFAULT_WIDTH,
            originalHeight: 0,
            isDragging: false,
            isResizing: false,
            isCollapsed: false,
            startX: 0,
            startY: 0,
            startLeft: 0,
            startTop: 0,
            startWidth: 0,
            startHeight: 0
        };

        // ==================== XPath CONFIGURATION ====================
        const XPATH_CONFIG = {
            main: "//div[@id='mainArea']/div[contains(@class, 'odds')]/div[contains(@class, 'c-odds-table')]/div[contains(@class, 'c-league')]/div[contains(@class, 'c-match-group')]/div[contains(@class, 'c-match')]/div[contains(@class, 'bets')]/div[contains(@class, 'odds-group')]",
            oddsGroup: "./div[contains(@class, 'odds')]",
            expressions: {
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
            }
        };

        // ==================== UTILITY FUNCTIONS ====================
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
         * Creates a table cell with consistent styling
         * @param {string} content - Cell content
         * @param {Object} options - Styling options
         * @returns {HTMLElement} - Styled table cell
         */
        function createTableCell(content, options = {}) {
            const td = document.createElement('td');
            td.textContent = content;
            
            const defaultStyle = `
                border: 1px solid ${CONSTANTS.COLORS.BORDER};
                padding: 4px;
                text-align: center;
                word-wrap: break-word;
                word-break: break-word;
                min-width: 60px;
            `;
            
            const customStyle = options.style || '';
            td.style.cssText = defaultStyle + customStyle;
            
            if (options.rowSpan) td.rowSpan = options.rowSpan;
            if (options.colSpan) td.colSpan = options.colSpan;
            if (options.backgroundColor) td.style.backgroundColor = options.backgroundColor;
            
            return td;
        }

        /**
         * Creates a block data structure for odds
         * @param {string} name - Block name
         * @param {Array} detailNames - Array of detail column names
         * @returns {Object} - Block structure
         */
        function createOddsBlock(name, detailNames) {
            return {
                name: name,
                detailNames: detailNames,
                details: []
            };
        }

        // ==================== DATA EXTRACTION ====================
        /**
         * Extracts betting odds data from the page using XPath
         * @returns {Array} - Array of match data with odds
         */
        function extractDataFromPage() {
            try {
                console.log('Odds Collector: Starting data extraction...');
                
                const matches = document.evaluate(XPATH_CONFIG.main, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                const extractedData = [];
                let currentId = 1;

                for (let i = 0; i < matches.snapshotLength; i++) {
                    const match = matches.snapshotItem(i);
                    
                    const teamA = getTextContent(XPATH_CONFIG.expressions.matchInfo.teamA, match);
                    const teamB = getTextContent(XPATH_CONFIG.expressions.matchInfo.teamB, match);
                    const matchTime = getTextContent(XPATH_CONFIG.expressions.matchInfo.time, match);
                    
                    const matchData = extractMatchData(match, teamA, teamB);
                    extractedData.push({
                        id: currentId++,
                        blocks: matchData
                    });
                }

                return extractedData;
            } catch (error) {
                console.error('Odds Collector: Error in extractDataFromPage:', error);
                return [];
            }
        }

        /**
         * Extracts data for a single match
         * @param {Node} match - Match DOM node
         * @param {string} teamA - Team A name
         * @param {string} teamB - Team B name
         * @returns {Array} - Array of odds blocks
         */
        function extractMatchData(match, teamA, teamB) {
            const matchInfo = createOddsBlock("Kèo trận", ["EV", "Mốc kèo", teamA, teamB]);
            const overUnder = createOddsBlock("Kèo Tài Xỉu", ["EV", "Mốc kèo", "Tài", "Xỉu"]);
            const odds1X2 = createOddsBlock("Kèo 1X2", ["EV", teamA, teamB, "Hoà"]);

            const oddsGroups = document.evaluate(XPATH_CONFIG.oddsGroup, match, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            
            for (let j = 0; j < oddsGroups.snapshotLength; j++) {
                const oddsGroup = oddsGroups.snapshotItem(j);
                
                extractOddsFromGroup(oddsGroup, matchInfo, overUnder, odds1X2);
            }

            return [matchInfo, overUnder, odds1X2];
        }

        /**
         * Extracts odds data from a single odds group
         * @param {Node} oddsGroup - Odds group DOM node
         * @param {Object} matchInfo - Match info block
         * @param {Object} overUnder - Over/under block
         * @param {Object} odds1X2 - 1X2 odds block
         */
        function extractOddsFromGroup(oddsGroup, matchInfo, overUnder, odds1X2) {
            const matchHandi = getTextContent(XPATH_CONFIG.expressions.matchOdd.handicapA, oddsGroup) === "" 
                ? getTextContent(XPATH_CONFIG.expressions.matchOdd.handicapB, oddsGroup) 
                : getTextContent(XPATH_CONFIG.expressions.matchOdd.handicapA, oddsGroup);

            // Match odds
            matchInfo.details.push([
                ["-EV-", 0],
                [matchHandi, 0],
                [getTextContent(XPATH_CONFIG.expressions.matchOdd.teamAodd, oddsGroup), 
                 getTextContent(XPATH_CONFIG.expressions.matchOdd.handicapA, oddsGroup) === "" ? 0 : 1],
                [getTextContent(XPATH_CONFIG.expressions.matchOdd.teamBodd, oddsGroup), 
                 getTextContent(XPATH_CONFIG.expressions.matchOdd.handicapB, oddsGroup) === "" ? 0 : 1]
            ]);

            // Over/under odds
            overUnder.details.push([
                ["-EV-", 0],
                [getTextContent(XPATH_CONFIG.expressions.overUnder.handicapA, oddsGroup), 0],
                [getTextContent(XPATH_CONFIG.expressions.overUnder.teamAodd, oddsGroup), 0],
                [getTextContent(XPATH_CONFIG.expressions.overUnder.teamBodd, oddsGroup), 0]
            ]);

            // 1X2 odds
            odds1X2.details.push([
                ["-EV-", 0],
                [getTextContent(XPATH_CONFIG.expressions.odds1X2.teamAodd, oddsGroup), 0],
                [getTextContent(XPATH_CONFIG.expressions.odds1X2.teamBodd, oddsGroup), 0],
                [getTextContent(XPATH_CONFIG.expressions.odds1X2.draw, oddsGroup), 0]
            ]);
        }

        // ==================== TABLE UPDATES ====================
        /**
         * Updates the popup table with extracted data
         * @param {Array} data - Array of match data
         * @param {HTMLElement} tbody - Table body element to update
         */
        function updateTableWithData(data, tbody) {
            try {
                console.log('Odds Collector: Updating table with data...');
                tbody.innerHTML = '';
                
                data.forEach((entity, entityIndex) => {
                    const maxDetails = Math.max(...entity.blocks.map(block => block.details.length));
                    const totalRows = 2 + maxDetails;
                    
                    createTableRowsForEntity(entity, totalRows, tbody);
                });

                adjustPopupWidth();
            } catch (error) {
                console.error('Odds Collector: Error in updateTableWithData:', error);
            }
        }

        /**
         * Creates table rows for a single entity
         * @param {Object} entity - Entity data
         * @param {number} totalRows - Total number of rows for this entity
         * @param {HTMLElement} tbody - Table body element
         */
        function createTableRowsForEntity(entity, totalRows, tbody) {
            for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
                const tr = document.createElement('tr');
                
                if (rowIndex === 0) {
                    tr.appendChild(createTableCell(entity.id, { 
                        rowSpan: totalRows, 
                        style: 'min-width: 30px;' 
                    }));
                }

                entity.blocks.forEach((block, blockIndex) => {
                    if (rowIndex === 0) {
                        tr.appendChild(createTableCell(block.name, { 
                            colSpan: 4, 
                            style: `background-color: ${CONSTANTS.COLORS.HEADER_BACKGROUND}; font-weight: bold; min-width: 80px;` 
                        }));
                    } else if (rowIndex === 1) {
                        block.detailNames.forEach(name => {
                            tr.appendChild(createTableCell(name, { 
                                style: `background-color: ${CONSTANTS.COLORS.HEADER_BACKGROUND}; min-width: 60px;` 
                            }));
                        });
                    } else {
                        const detailIndex = rowIndex - 2;
                        const details = block.details[detailIndex] || ['', '', '', ''];
                        details.forEach(value => {
                            const style = value[1] == 1 ? `background-color: ${CONSTANTS.COLORS.HIGHLIGHT};` : '';
                            tr.appendChild(createTableCell(value[0], { style }));
                        });
                    }
                });

                if (rowIndex === 0) {
                    tr.appendChild(createTableCell('', { 
                        rowSpan: totalRows, 
                        style: 'min-width: 30px;' 
                    }));
                }

                tbody.appendChild(tr);
            }
        }

        /**
         * Adjusts popup width based on table content
         */
        function adjustPopupWidth() {
            const table = document.querySelector('#odds-collector-popup table');
            if (!table) return;

            table.style.display = 'none';
            table.offsetHeight; // Force reflow
            table.style.display = '';

            const totalWidth = Array.from(table.querySelectorAll('th')).reduce((sum, th) => {
                return sum + th.offsetWidth;
            }, 0);

            const popup = document.getElementById('odds-collector-popup');
            if (popup) {
                const newWidth = Math.min(
                    Math.max(totalWidth + CONSTANTS.POPUP.PADDING + CONSTANTS.POPUP.BORDER_WIDTH, CONSTANTS.POPUP.MIN_WIDTH), 
                    window.innerWidth - CONSTANTS.POPUP.MARGIN_FROM_EDGE
                );
                
                popup.offsetHeight; // Force reflow
                popup.style.width = `${newWidth}px`;
                
                state.originalWidth = newWidth;
                state.originalHeight = popup.offsetHeight;
                
                window.logToPopup(`Popup width adjusted to ${newWidth}px`);
            }
        }

        // ==================== REFRESH MANAGEMENT ====================
        /**
         * Main refresh function - extracts and updates data
         * Also manages refresh interval based on results
         */
        function refreshData() {
            try {
                console.log('Odds Collector: Refreshing data...');
                const extractedData = extractDataFromPage();
                updateTableWithData(extractedData, window.oddsCollectorTbody);
                
                updateRefreshInterval(extractedData.length);
                window.logToPopup(`Successfully extracted ${extractedData.length} matches at ${new Date().toLocaleTimeString()}`);
            } catch (error) {
                console.error('Odds Collector: Error in refreshData:', error);
                window.logToPopup(`Error extracting data: ${error.message}`);
            }
        }

        /**
         * Updates refresh interval based on match results
         * @param {number} matchCount - Number of matches found
         */
        function updateRefreshInterval(matchCount) {
            if (matchCount === 0) {
                state.currentInterval = CONSTANTS.REFRESH.NO_MATCHES_INTERVAL;
                window.logToPopup(`No matches found. Changing refresh interval to ${state.currentInterval}s`);
            } else {
                state.currentInterval = CONSTANTS.REFRESH.MATCHES_FOUND_INTERVAL;
                window.logToPopup(`Found ${matchCount} matches. Changing refresh interval to ${state.currentInterval}s`);
            }
        }

        /**
         * Starts the auto-refresh interval
         * Manages countdown and refresh timing
         */
        function startRefreshInterval() {
            try {
                if (state.refreshIntervalId) {
                    clearInterval(state.refreshIntervalId);
                }
                
                state.refreshIntervalId = setInterval(() => {
                    if (!state.isPaused) {
                        state.timeLeft--;
                        if (state.timeLeft <= 0) {
                            refreshData();
                            state.timeLeft = state.currentInterval;
                        }
                        window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`;
                    }
                }, 1000);
            } catch (error) {
                console.error('Odds Collector: Error in startRefreshInterval:', error);
            }
        }

        // ==================== EVENT HANDLERS ====================
        /**
         * Sets up drag and drop functionality for the popup
         * @param {HTMLElement} popup - Popup element
         * @param {HTMLElement} header - Header element
         */
        function setupDragAndDrop(popup, header) {
            const handleMouseDown = (e) => {
                if (e.target === header || e.target.closest('.title-container') || e.target.closest('.title')) {
                    state.isDragging = true;
                    state.startX = e.clientX;
                    state.startY = e.clientY;
                    const rect = popup.getBoundingClientRect();
                    state.startLeft = rect.left;
                    state.startTop = rect.top;
                    e.preventDefault();
                }
            };

            const handleMouseMove = (e) => {
                if (!state.isDragging) return;
                
                const dx = e.clientX - state.startX;
                const dy = e.clientY - state.startY;
                
                popup.style.left = `${state.startLeft + dx}px`;
                popup.style.top = `${state.startTop + dy}px`;
            };

            const handleMouseUp = () => {
                state.isDragging = false;
            };

            header.addEventListener('mousedown', handleMouseDown);
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            // Store cleanup function
            popup._dragCleanup = () => {
                header.removeEventListener('mousedown', handleMouseDown);
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }

        /**
         * Sets up resize functionality for the popup
         * @param {HTMLElement} popup - Popup element
         * @param {HTMLElement} resizeHandle - Resize handle element
         */
        function setupResize(popup, resizeHandle) {
            const handleMouseDown = (e) => {
                state.isResizing = true;
                state.startX = e.clientX;
                state.startY = e.clientY;
                state.startWidth = popup.offsetWidth;
                state.startHeight = popup.offsetHeight;
                e.preventDefault();
            };

            const handleMouseMove = (e) => {
                if (!state.isResizing) return;

                const dx = e.clientX - state.startX;
                const dy = e.clientY - state.startY;
                
                const newWidth = Math.max(CONSTANTS.POPUP.MIN_WIDTH, state.startWidth + dx);
                const newHeight = Math.max(CONSTANTS.POPUP.MIN_HEIGHT, state.startHeight + dy);
                
                popup.style.width = `${newWidth}px`;
                popup.style.height = `${newHeight}px`;
                
                state.originalWidth = newWidth;
                state.originalHeight = newHeight;
            };

            const handleMouseUp = () => {
                state.isResizing = false;
            };

            resizeHandle.addEventListener('mousedown', handleMouseDown);
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            // Store cleanup function
            popup._resizeCleanup = () => {
                resizeHandle.removeEventListener('mousedown', handleMouseDown);
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }

        /**
         * Sets up toggle functionality for the popup
         * @param {HTMLElement} popup - Popup element
         * @param {HTMLElement} toggleBtn - Toggle button
         * @param {HTMLElement} contentWrapper - Content wrapper
         */
        function setupToggle(popup, toggleBtn, contentWrapper) {
            toggleBtn.addEventListener('click', () => {
                state.isCollapsed = !state.isCollapsed;
                if (state.isCollapsed) {
                    popup.style.height = `${CONSTANTS.POPUP.HEADER_HEIGHT}px`;
                    popup.style.width = `${CONSTANTS.POPUP.DEFAULT_WIDTH}px`;
                    contentWrapper.style.display = 'none';
                    popup.style.minHeight = `${CONSTANTS.POPUP.HEADER_HEIGHT}px`;
                    popup.style.minWidth = `${CONSTANTS.POPUP.DEFAULT_WIDTH}px`;
                    toggleBtn.textContent = '+';
                } else {
                    popup.style.height = `${state.originalHeight}px`;
                    popup.style.width = `${state.originalWidth}px`;
                    popup.style.minHeight = `${CONSTANTS.POPUP.MIN_HEIGHT}px`;
                    popup.style.minWidth = `${CONSTANTS.POPUP.MIN_WIDTH}px`;
                    contentWrapper.style.display = 'flex';
                    toggleBtn.textContent = '−';
                }
            });
        }

        /**
         * Sets up refresh button functionality
         * @param {HTMLElement} refreshButton - Refresh button
         */
        function setupRefreshButton(refreshButton) {
            refreshButton.addEventListener('click', () => {
                try {
                    refreshButton.classList.add('spinning');
                    refreshData();
                    state.timeLeft = state.currentInterval;
                    window.oddsCollectorRefreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`;
                    setTimeout(() => {
                        refreshButton.classList.remove('spinning');
                    }, CONSTANTS.ANIMATIONS.SPIN_DURATION);
                    window.logToPopup('Manual refresh triggered');
                } catch (error) {
                    console.error('Odds Collector: Error in refresh button click:', error);
                }
            });
        }

        /**
         * Sets up refresh indicator functionality
         * @param {HTMLElement} refreshIndicator - Refresh indicator
         * @param {HTMLElement} header - Header element
         * @param {HTMLElement} refreshButton - Refresh button
         */
        function setupRefreshIndicator(refreshIndicator, header, refreshButton) {
            refreshIndicator.addEventListener('click', () => {
                try {
                    if (state.isPaused) {
                        // Resume refresh
                        state.isPaused = false;
                        header.classList.remove('flashing');
                        refreshData();
                        state.timeLeft = state.currentInterval;
                        refreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`;
                        refreshButton.style.display = 'flex';
                        startRefreshInterval();
                        window.logToPopup('Auto-refresh resumed with immediate refresh');
                    } else {
                        // Pause refresh
                        state.isPaused = true;
                        header.classList.add('flashing');
                        refreshIndicator.textContent = 'Auto-refresh is paused';
                        refreshButton.style.display = 'none';
                        window.logToPopup('Auto-refresh paused');
                    }
                } catch (error) {
                    console.error('Odds Collector: Error in refresh indicator click:', error);
                }
            });
        }

        // ==================== POPUP CREATION ====================
        /**
         * Creates the header section of the popup
         * @returns {HTMLElement} - Header element
         */
        function createHeader() {
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 8px;
                background: linear-gradient(to right, ${CONSTANTS.COLORS.HEADER_GRADIENT_START}, ${CONSTANTS.COLORS.HEADER_GRADIENT_END});
                border-bottom: 1px solid ${CONSTANTS.COLORS.BORDER};
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                user-select: none;
                flex-shrink: 0;
                box-sizing: border-box;
                height: ${CONSTANTS.POPUP.HEADER_HEIGHT}px;
                line-height: 24px;
                color: white;
            `;

            return header;
        }

        /**
         * Creates the title section of the header
         * @returns {HTMLElement} - Title container
         */
        function createTitleSection() {
            const titleContainer = document.createElement('div');
            titleContainer.className = 'title-container';
            titleContainer.style.cssText = `
                display: flex;
                align-items: center;
                min-width: 0;
                flex: 1;
                gap: 16px;
            `;

            const title = document.createElement('span');
            title.className = 'title';
            title.textContent = 'Odds Collector';
            title.style.cssText = `
                font-weight: bold;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: white;
                flex-shrink: 0;
            `;

            titleContainer.appendChild(title);
            return titleContainer;
        }

        /**
         * Creates the refresh controls section
         * @returns {Object} - Object containing refresh elements
         */
        function createRefreshControls() {
            const refreshContainer = document.createElement('div');
            refreshContainer.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            `;

            const refreshIndicator = document.createElement('span');
            refreshIndicator.style.cssText = `
                font-size: 12px;
                color: #ccc;
                min-width: 80px;
                text-align: right;
                cursor: pointer;
                user-select: none;
            `;
            refreshIndicator.textContent = `Auto-refresh in: ${state.timeLeft}s`;

            const refreshButton = document.createElement('button');
            refreshButton.innerHTML = '↻';
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

            refreshContainer.appendChild(refreshIndicator);
            refreshContainer.appendChild(refreshButton);

            return { refreshContainer, refreshIndicator, refreshButton };
        }

        /**
         * Creates the toggle button
         * @returns {HTMLElement} - Toggle button
         */
        function createToggleButton() {
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
            return toggleBtn;
        }

        /**
         * Creates the main content area
         * @returns {Object} - Object containing content elements
         */
        function createMainContent() {
            const contentWrapper = document.createElement('div');
            contentWrapper.style.cssText = `
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 0;
                overflow: hidden;
                box-sizing: border-box;
            `;

            const mainContent = document.createElement('div');
            mainContent.style.cssText = `
                flex: 1;
                padding: 10px;
                overflow-y: auto;
                min-height: 0;
                box-sizing: border-box;
            `;

            const table = createTable();
            mainContent.appendChild(table);

            const logArea = document.createElement('textarea');
            logArea.style.cssText = `
                width: calc(100% - 20px);
                height: 100px;
                margin: 10px;
                padding: 5px;
                border: 1px solid ${CONSTANTS.COLORS.BORDER};
                resize: none;
                box-sizing: border-box;
                flex-shrink: 0;
            `;
            logArea.readOnly = true;

            contentWrapper.appendChild(mainContent);
            contentWrapper.appendChild(logArea);

            return { contentWrapper, mainContent, table, logArea };
        }

        /**
         * Creates the data table
         * @returns {HTMLElement} - Table element
         */
        function createTable() {
            const table = document.createElement('table');
            table.style.cssText = `
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
                margin-bottom: 10px;
                table-layout: auto;
            `;

            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th style="width: 5%; border: 1px solid ${CONSTANTS.COLORS.BORDER}; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 30px;">#</th>
                    <th colspan="4" style="border: 1px solid ${CONSTANTS.COLORS.BORDER}; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 80px;"></th>
                    <th colspan="4" style="border: 1px solid ${CONSTANTS.COLORS.BORDER}; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 80px;"></th>
                    <th colspan="4" style="border: 1px solid ${CONSTANTS.COLORS.BORDER}; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 80px;"></th>
                    <th style="width: 5%; border: 1px solid ${CONSTANTS.COLORS.BORDER}; padding: 4px; word-wrap: break-word; word-break: break-word; min-width: 30px;"></th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            table.appendChild(tbody);

            return table;
        }

        /**
         * Creates the resize handle
         * @returns {HTMLElement} - Resize handle
         */
        function createResizeHandle() {
            const resizeHandle = document.createElement('div');
            resizeHandle.style.cssText = `
                position: absolute;
                right: 0;
                bottom: 0;
                width: 10px;
                height: 10px;
                cursor: se-resize;
                background: linear-gradient(135deg, transparent 50%, ${CONSTANTS.COLORS.BORDER} 50%);
                z-index: 1;
            `;
            return resizeHandle;
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
                    width: ${CONSTANTS.POPUP.DEFAULT_WIDTH}px;
                    min-width: ${CONSTANTS.POPUP.MIN_WIDTH}px;
                    max-width: calc(100vw - ${CONSTANTS.POPUP.MARGIN_FROM_EDGE}px);
                    max-height: calc(100vh - ${CONSTANTS.POPUP.MARGIN_FROM_EDGE}px);
                    background: ${CONSTANTS.COLORS.BACKGROUND};
                    border: 1px solid ${CONSTANTS.COLORS.BORDER};
                    border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    will-change: transform;
                    box-sizing: border-box;
                    overflow: hidden;
                `;

                // Create header
                const header = createHeader();
                const titleContainer = createTitleSection();
                const { refreshContainer, refreshIndicator, refreshButton } = createRefreshControls();
                const toggleBtn = createToggleButton();

                // Create content
                const { contentWrapper, mainContent, table, logArea } = createMainContent();
                const tbody = table.querySelector('tbody');
                const resizeHandle = createResizeHandle();

                // Assemble the popup
                titleContainer.appendChild(refreshContainer);
                header.appendChild(titleContainer);
                header.appendChild(toggleBtn);
                popup.appendChild(header);
                popup.appendChild(contentWrapper);
                popup.appendChild(resizeHandle);

                // Store original dimensions
                state.originalWidth = CONSTANTS.POPUP.DEFAULT_WIDTH;
                state.originalHeight = popup.offsetHeight;

                // Setup event handlers
                setupDragAndDrop(popup, header);
                setupResize(popup, resizeHandle);
                setupToggle(popup, toggleBtn, contentWrapper);
                setupRefreshButton(refreshButton);
                setupRefreshIndicator(refreshIndicator, header, refreshButton);

                // Add logging function
                window.logToPopup = function(message) {
                    const timestamp = new Date().toLocaleTimeString();
                    logArea.value += `[${timestamp}] ${message}\n`;
                    logArea.scrollTop = logArea.scrollHeight;
                };

                // Store references
                window.oddsCollectorTbody = tbody;
                window.oddsCollectorRefreshIndicator = refreshIndicator;
                window.oddsCollectorRefreshButton = refreshButton;
                window.oddsCollectorHeader = header;

                // Initialize refresh button visibility
                refreshButton.style.display = 'flex';

                return popup;
            } catch (error) {
                console.error('Odds Collector: Error in createFloatingPopup:', error);
                throw error;
            }
        }

        // ==================== CLEANUP AND INITIALIZATION ====================
        /**
         * Cleans up all event listeners and intervals
         * @param {HTMLElement} popup - Popup element to cleanup
         */
        function cleanup(popup) {
            if (state.refreshIntervalId) {
                clearInterval(state.refreshIntervalId);
                state.refreshIntervalId = null;
            }

            if (popup._dragCleanup) {
                popup._dragCleanup();
            }

            if (popup._resizeCleanup) {
                popup._resizeCleanup();
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
                    cleanup(popup);
                });

                // Clean up when popup is removed from DOM
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.removedNodes.forEach((node) => {
                            if (node === popup) {
                                cleanup(popup);
                                observer.disconnect();
                            }
                        });
                    });
                });

                observer.observe(document.body, { childList: true });
            } catch (error) {
                console.error('Odds Collector: Error in initialization:', error);
            }
        });

        console.log('Odds Collector: Script loaded successfully');
    } catch (error) {
        console.error('Odds Collector: Fatal error in script:', error);
    }
})();