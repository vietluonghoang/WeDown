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