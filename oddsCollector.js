// Tamper Monkey Script
// ==UserScript==
// @name         Get Odds
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Simply get the odds
// @author       Viet Cat
// @match        https://*.viva88.com//*
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
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 9999;
            transition: all 0.3s ease;
        `;

        // Create header bar
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 8px;
            background: #f0f0f0;
            border-bottom: 1px solid #ccc;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        // Create title
        const title = document.createElement('span');
        title.textContent = 'Odds Collector';
        title.style.fontWeight = 'bold';

        // Create toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '−';
        toggleBtn.style.cssText = `
            border: none;
            background: none;
            cursor: pointer;
            font-size: 16px;
            padding: 0 5px;
        `;

        // Create content area
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 10px;
            height: 200px;
            overflow-y: auto;
        `;

        // Create log area
        const logArea = document.createElement('textarea');
        logArea.style.cssText = `
            width: 100%;
            height: 100px;
            margin-top: 10px;
            padding: 5px;
            border: 1px solid #ccc;
            resize: none;
        `;
        logArea.readOnly = true;

        // Assemble the popup
        header.appendChild(title);
        header.appendChild(toggleBtn);
        content.appendChild(logArea);
        popup.appendChild(header);
        popup.appendChild(content);
        document.body.appendChild(popup);

        // Make popup draggable
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === header || e.target === title) {
                isDragging = true;
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                setTranslate(currentX, currentY, popup);
            }
        }

        function dragEnd() {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }

        function setTranslate(xPos, yPos, el) {
            el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
        }

        // Toggle popup size
        let isCollapsed = false;
        const originalHeight = popup.offsetHeight;
        const headerHeight = header.offsetHeight;

        toggleBtn.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            if (isCollapsed) {
                popup.style.height = `${headerHeight}px`;
                popup.style.width = `${headerHeight * 3}px`;
                content.style.display = 'none';
                toggleBtn.textContent = '+';
            } else {
                popup.style.height = `${originalHeight}px`;
                popup.style.width = '300px';
                content.style.display = 'block';
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