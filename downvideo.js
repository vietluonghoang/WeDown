// Tamper Monkey Script
// ==UserScript==
// @name         Get Facebook Video Link
// @namespace    http://tampermonkey.net/
// @version      0.1.6
// @description  Simply get the downloadable video facebooklink from the page source
// @author       Viet Cat
// @match        https://www.facebook.com/*
// @grant        none
// ==/UserScript==

var findPlayVideoInterval;
var videoDownloadPanel;
var videoLinksPanel;
var infoPanel;
var rawVideoLinks = new Map();
var hasStarted = false;
let topOffset;
let leftOffset;
let videoDownloadPanelId = "pnlVidDnl";
let videoLinksPanelId = "pnlVidLk";
let infoPanelID = "pnlInfo";
let observer;

// Add near the top with other variables
const CONFIG = {
    enableConsoleLog: true,
    enableUILog: true,
    debugMode: false
};

// Add these constants for regex patterns
const VIDEO_PATTERNS = {
    HD: /,{"progressive_url":"(.*?)","failure_reason":(.*?),"metadata":{"quality":"HD"}/g,
    SD: /\[{"progressive_url":"(.*?)","failure_reason":(.*?),"metadata":{"quality":"SD"}/g,
    RESOLUTION: /(?<="base_url":)(.*?)(\])/g
};

// Add to the top with other constants
const INTERVALS = {
    DEFAULT: 2000,  // 2 seconds
    AFTER_FOUND: 30000  // 30 seconds
};

function cleanup() {
    if (findPlayVideoInterval) {
        clearInterval(findPlayVideoInterval);
    }
    if (observer) {
        observer.disconnect();
    }
    // Remove existing panels if they exist
    const existingPanel = document.getElementById(videoDownloadPanelId);
    if (existingPanel) {
        existingPanel.remove();
    }
}

(function () {
    cleanup(); // Clean up any existing instances

    // Create the observer
    observer = new MutationObserver((mutations) => {
        if (!document.getElementById(videoDownloadPanelId)) {
            initializeScript();
        }
    });

    ['DOMContentLoaded', 'load'].forEach(event => {
        window.addEventListener(event, initializeScript);
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Handle cleanup when navigating away
    window.addEventListener('beforeunload', cleanup);
})();

function initializeScript() {
    appendLogText("------------\npage loaded....\n------------");
    if (findPlayVideoInterval) {
        clearInterval(findPlayVideoInterval);
    }
    
    const interval = rawVideoLinks.size > 0 ? INTERVALS.AFTER_FOUND : INTERVALS.DEFAULT;
    findPlayVideoInterval = setInterval(checkForLinks, interval);
}

function checkForLinks(){
    appendLogText("------------\nscanning....\n------------");
    if(!hasStarted){
        hasStarted = true;
        initComponents();
        appendLogText("Remove all links...");
        rawVideoLinks = new Map();
        appendURL();
        hasStarted = false;
    }else{
        appendLogText("Scanning is in progress already...");
    }
}

function generateVideoLinksPanel(){
    appendLogText("------------\nGenerating Video Links panel...\n------------");
    //create a new panel for all links
    videoLinksPanel = document.createElement("div");
    videoLinksPanel.name = videoLinksPanelId;
    videoLinksPanel.id = videoLinksPanelId;
    videoLinksPanel.style.width = 'fit-content';
    videoLinksPanel.style.position = 'relative';
    videoLinksPanel.style.margin = '10px 0px';
    videoLinksPanel.style.zIndex = '5000';
    videoLinksPanel.style.display = 'flex';
    videoLinksPanel.style.flexDirection = 'column';
    videoLinksPanel.style.alignItems = 'center';
    videoLinksPanel.style.backgroundColor = '#ffffff';
    videoLinksPanel.style.padding = '10px';

    // Add the links panel to the content container
    const contentContainer = videoDownloadPanel.querySelector('div:nth-child(2)');
    if (contentContainer) {
        contentContainer.appendChild(videoLinksPanel);
    }
}

function generateInfoPanel(){
    appendLogText("------------\nGenerating Info panel...\n------------");
    //create a new panel for info
    infoPanel = document.createElement("textarea");
    infoPanel.name = infoPanelID;
    infoPanel.id = infoPanelID;
    infoPanel.style.width = "calc(100% - 20px)"; // Account for padding
    infoPanel.style.height = "100px";
    infoPanel.style.position = 'relative';
    infoPanel.style.margin = '10px';
    infoPanel.rows = 4;
    infoPanel.style.zIndex = "5000";
    infoPanel.style.backgroundColor = "#f5f5f5";
    infoPanel.style.border = "1px solid #ddd";
    infoPanel.style.borderRadius = "4px";
    infoPanel.style.padding = "8px";
    infoPanel.style.fontSize = "12px";
    infoPanel.style.fontFamily = "monospace";
    infoPanel.style.resize = "vertical";

    // Add the info panel to the content container
    const contentContainer = videoDownloadPanel.querySelector('div:nth-child(2)');
    if (contentContainer) {
        contentContainer.appendChild(infoPanel);
    }
}

function generateVideoDownloadPanel(){
    appendLogText("------------\nGenerating Video Download panel...\n------------");
    
    // Create panel
    videoDownloadPanel = document.createElement("div");
    videoDownloadPanel.name = videoDownloadPanelId;
    videoDownloadPanel.id = videoDownloadPanelId;
    videoDownloadPanel.style.top = "50px";
    videoDownloadPanel.style.left = "50px";
    videoDownloadPanel.style.position = "fixed";
    videoDownloadPanel.style.margin = "10px 0px";
    videoDownloadPanel.style.width = "fit-content";
    videoDownloadPanel.style.maxHeight = "90vh"; // Limit height to 90% of viewport height
    videoDownloadPanel.style.display = "flex";
    videoDownloadPanel.style.flexDirection = "column";
    videoDownloadPanel.style.alignItems = 'center';
    videoDownloadPanel.style.zIndex = "5000";
    videoDownloadPanel.style.backgroundColor = "#ffffff"; // Add background color
    videoDownloadPanel.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)"; // Add shadow for better visibility
    
    // Add header bar
    const headerBar = createHeaderBar();
    videoDownloadPanel.appendChild(headerBar);
    
    // Create scrollable content container
    const contentContainer = document.createElement("div");
    contentContainer.style.width = "100%";
    contentContainer.style.flex = "1";
    contentContainer.style.overflowY = "auto";
    contentContainer.style.overflowX = "hidden";
    contentContainer.style.maxHeight = "calc(90vh - 50px)"; // Subtract header height
    contentContainer.style.scrollbarWidth = "thin"; // For Firefox
    contentContainer.style.scrollbarColor = "#888 #f1f1f1"; // For Firefox
    
    // Add custom scrollbar styles for WebKit browsers
    contentContainer.style.cssText += `
        &::-webkit-scrollbar {
            width: 8px;
        }
        &::-webkit-scrollbar-track {
            background: #f1f1f1;
        }
        &::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }
        &::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
    `;
    
    videoDownloadPanel.appendChild(contentContainer);
    
    // Add to DOM
    document.body.appendChild(videoDownloadPanel);

    // Set initial position
    topOffset = videoDownloadPanel.offsetTop;
    leftOffset = videoDownloadPanel.offsetLeft;
    window.addEventListener('load', updateFloatingTablePosition);
    window.addEventListener('scroll', updateFloatingTablePosition);
    
    return contentContainer; // Return the content container for other functions to use
}

function createHeaderBar() {
    const headerBar = document.createElement('div');
    headerBar.style.width = '100%';
    headerBar.style.padding = '10px';
    headerBar.style.backgroundColor = '#f0f0f0';
    headerBar.style.borderBottom = '1px solid #ddd';
    headerBar.style.display = 'flex';
    headerBar.style.alignItems = 'center';
    headerBar.style.justifyContent = 'space-between';
    headerBar.style.borderRadius = '4px 4px 0 0';

    const title = document.createElement('span');
    title.textContent = 'Facebook Video Downloader';
    title.style.fontWeight = 'bold';

    const searchControl = createSearchControl();
    
    headerBar.appendChild(title);
    headerBar.appendChild(searchControl);
    
    return headerBar;
}

function createSearchControl() {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '10px';

    const button = document.createElement('button');
    button.id = 'searchControlBtn';
    button.style.padding = '5px 10px';
    button.style.borderRadius = '4px';
    button.style.border = 'none';
    button.style.cursor = 'pointer';
    button.style.backgroundColor = '#4CAF50';
    button.style.color = 'white';

    const countdownText = document.createElement('span');
    countdownText.id = 'searchCountdown';
    
    container.appendChild(button);
    container.appendChild(countdownText);

    let countdown = INTERVALS.DEFAULT / 1000;
    let countdownInterval;
    
    function updateButtonState(isSearching) {
        if (isSearching) {
            button.textContent = 'Stop';
            button.style.backgroundColor = '#f44336';
            updateCountdown();
        } else {
            button.textContent = 'Search now';
            button.style.backgroundColor = '#4CAF50';
            countdownText.textContent = '';
            if (countdownInterval) {
                clearInterval(countdownInterval);
            }
        }
    }

    function updateCountdown() {
        countdown = findPlayVideoInterval ? 
            (rawVideoLinks.size > 0 ? INTERVALS.AFTER_FOUND : INTERVALS.DEFAULT) / 1000 : 
            INTERVALS.DEFAULT / 1000;
            
        function tick() {
            countdown--;
            countdownText.textContent = `Searching in ${countdown}s...`;
            if (countdown <= 0) {
                countdown = findPlayVideoInterval ? 
                    (rawVideoLinks.size > 0 ? INTERVALS.AFTER_FOUND : INTERVALS.DEFAULT) / 1000 : 
                    INTERVALS.DEFAULT / 1000;
            }
        }

        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        countdownText.textContent = `Searching in ${countdown}s...`;
        countdownInterval = setInterval(tick, 1000);
    }

    button.addEventListener('click', () => {
        if (findPlayVideoInterval) {
            // Stop searching
            clearInterval(findPlayVideoInterval);
            findPlayVideoInterval = null;
            updateButtonState(false);
        } else {
            // Clear existing links
            rawVideoLinks.clear();
            
            // Remove existing video elements
            const videoLinksPanel = document.getElementById(videoLinksPanelId);
            if (videoLinksPanel) {
                removeAllChildNodes(videoLinksPanel);
            }
            
            // Perform immediate search
            checkForLinks();
            
            // Start interval with default timing
            findPlayVideoInterval = setInterval(checkForLinks, INTERVALS.DEFAULT);
            updateButtonState(true);
        }
    });

    // Initial state
    updateButtonState(!!findPlayVideoInterval);
    
    return container;
}

function initComponents(){
    //check if the panel for video download is existed
    videoDownloadPanel = document.getElementById(videoDownloadPanelId);
    if(videoDownloadPanel == null){
        generateVideoDownloadPanel();
    }else{
        // Keep the header bar and only remove video links panel and info panel
        const videoLinksPanel = document.getElementById(videoLinksPanelId);
        if (videoLinksPanel) {
            videoLinksPanel.remove();
        }
        const infoPanel = document.getElementById(infoPanelID);
        if (infoPanel) {
            infoPanel.remove();
        }
    }

    //check if the panel for all link is existed
    videoLinksPanel = document.getElementById(videoLinksPanelId);
    if(videoLinksPanel == null){
        generateVideoLinksPanel();
    }

    //check if the panel for info is existed
    infoPanel = document.getElementById(infoPanelID);
    if(infoPanel == null){
        generateInfoPanel();
    }
}

function appendURL() {
    try {
        appendLogText("Starting video link scan", 'info');
        const pageSource = document.documentElement.outerHTML;
        const previousLinksCount = rawVideoLinks.size;
        let foundLinks = false;

        // Debug log to check page source
        if (CONFIG.debugMode) {
            appendLogText("Scanning page source length: " + pageSource.length, 'debug');
        }

        // Extract HD videos
        let hdMatch;
        while ((hdMatch = VIDEO_PATTERNS.HD.exec(pageSource)) !== null) {
            try {
                const videoLink = hdMatch[1];
                if (isValidVideoUrl(videoLink)) {
                    appendLogText("Found HD video link", 'debug');
                    rawVideoLinks.set(videoLink, "HD");
                    foundLinks = true;
                }
            } catch (error) {
                appendLogText(`Error processing HD link: ${error.message}`, 'error');
            }
        }

        // Extract SD videos
        let sdMatch;
        while ((sdMatch = VIDEO_PATTERNS.SD.exec(pageSource)) !== null) {
            try {
                const videoLink = sdMatch[1];
                if (isValidVideoUrl(videoLink)) {
                    appendLogText("Found SD video link", 'debug');
                    rawVideoLinks.set(videoLink, "SD");
                    foundLinks = true;
                }
            } catch (error) {
                appendLogText(`Error processing SD link: ${error.message}`, 'error');
            }
        }

        // Extract resolution-specific videos
        let resMatch;
        let resolutionCounter = 0;
        while ((resMatch = VIDEO_PATTERNS.RESOLUTION.exec(pageSource)) !== null) {
            try {
                resolutionCounter++;
                const basedUrl = resMatch[1] + "";
                appendLogText(`Found resolution-specific URL [${resolutionCounter}]`, 'debug');

                // Extract URL
                const urlMatch = /(?<=")(.*?)","bandwidth/g.exec(basedUrl);
                if (!urlMatch) continue;
                const videoLink = urlMatch[1];

                // Extract dimensions
                const heightMatch = /(?<="height":)(.*?),"width"/g.exec(basedUrl);
                const widthMatch = /(?<="width":)(.*?),"playback_resolution_mos/g.exec(basedUrl);

                if (heightMatch && widthMatch && isValidVideoUrl(videoLink)) {
                    const height = heightMatch[1];
                    const width = widthMatch[1];
                    const resolution = `${height}x${width}`;
                    rawVideoLinks.set(videoLink, resolution);
                    foundLinks = true;
                    appendLogText(`Added ${resolution} video`, 'debug');
                }
            } catch (error) {
                appendLogText(`Error processing resolution link: ${error.message}`, 'error');
            }
        }

        if (!foundLinks) {
            appendLogText("No video links found on this page", 'warn');
            // Debug log the first 500 chars of page source if in debug mode
            if (CONFIG.debugMode) {
                appendLogText("First 500 chars of page source: " + pageSource.substring(0, 500), 'debug');
            }
        } else {
            appendLogText(`Found ${rawVideoLinks.size} video links`, 'info');
            generateLinkButtons();
        }

        // After scanning, update interval if links were found
        if (rawVideoLinks.size > previousLinksCount) {
            clearInterval(findPlayVideoInterval);
            findPlayVideoInterval = setInterval(checkForLinks, INTERVALS.AFTER_FOUND);
            
            // Update countdown display
            const countdownText = document.getElementById('searchCountdown');
            if (countdownText) {
                countdownText.textContent = `Searching in ${INTERVALS.AFTER_FOUND / 1000}s...`;
            }
        }
    } catch (error) {
        appendLogText(`Failed to process video links: ${error.message}`, 'error');
    }
}

// Update isValidVideoUrl to be less strict
function isValidVideoUrl(url) {
    try {
        if (!url) return false;
        
        // Clean the URL first
        url = url.replace(/\\/g, "");
        url = url.replace(/u0025/g, "%");
        
        const urlObj = new URL(url);
        
        // Accept more Facebook CDN domains
        const validDomains = ['fbcdn.net', 'facebook.com', 'fbsbx.com'];
        const isValidDomain = validDomains.some(domain => urlObj.hostname.includes(domain));
        
        return urlObj.protocol === 'https:' && 
               isValidDomain && 
               (url.endsWith('.mp4') || url.includes('video') || url.includes('fbcdn'));
    } catch (error) {
        appendLogText(`Invalid URL: ${error.message}`, 'debug');
        return false;
    }
}

function generateLinkButtons() {
    let buttonCounter = 0;
    appendLogText(`Generating buttons for ${rawVideoLinks.size} videos`, 'info');

    for (let [videoLink, quality] of rawVideoLinks) {
        buttonCounter++;
        
        // Create container for video player and buttons
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.margin = '5px';
        container.style.padding = '5px';
        container.style.backgroundColor = '#f0f0f0';
        container.style.borderRadius = '5px';
        container.style.width = 'fit-content';

        // Create video player
        const videoContainer = document.createElement('div');
        videoContainer.style.height = '100px'; // Fixed height
        videoContainer.style.marginRight = '10px';
        videoContainer.style.position = 'relative';
        videoContainer.style.overflow = 'hidden';

        const video = document.createElement('video');
        video.style.height = '100%';
        video.style.objectFit = 'contain'; // Changed from 'cover' to 'contain'
        video.style.borderRadius = '4px';
        video.style.backgroundColor = '#000'; // Add background for letterboxing
        video.controls = true;
        video.preload = 'metadata';
        video.muted = true;

        // Add event listener to adjust container width based on video metadata
        video.addEventListener('loadedmetadata', () => {
            const aspectRatio = video.videoWidth / video.videoHeight;
            const containerWidth = Math.round(100 * aspectRatio); // Calculate width based on 100px height
            videoContainer.style.width = `${containerWidth}px`;
        });

        // Clean the video URL
        const cleanedUrl = cleanVideoUrl(videoLink);
        video.src = cleanedUrl;

        // Add play/pause overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.3)';
        overlay.style.cursor = 'pointer';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s';

        // Show overlay on hover
        videoContainer.addEventListener('mouseenter', () => {
            overlay.style.opacity = '1';
        });
        videoContainer.addEventListener('mouseleave', () => {
            overlay.style.opacity = '0';
        });

        // Add play/pause functionality
        overlay.addEventListener('click', () => {
            if (video.paused) {
                // Pause all other videos first
                document.querySelectorAll('video').forEach(v => {
                    if (v !== video) v.pause();
                });
                video.play();
            } else {
                video.pause();
            }
        });

        videoContainer.appendChild(video);
        videoContainer.appendChild(overlay);

        // Create button with progress bar
        const buttonWrapper = document.createElement('div');
        buttonWrapper.style.position = 'relative';
        
        const button = createDownloadButton(buttonCounter, quality, videoLink);
        const progressBar = createProgressBar();
        
        buttonWrapper.appendChild(button);
        buttonWrapper.appendChild(progressBar);
        
        container.appendChild(videoContainer);
        container.appendChild(buttonWrapper);
        videoLinksPanel.appendChild(container);

        // Handle video errors
        video.addEventListener('error', () => {
            appendLogText(`Failed to load video ${buttonCounter}`, 'error');
            videoContainer.style.backgroundColor = '#ffebee';
            const errorMsg = document.createElement('div');
            errorMsg.textContent = 'Video preview unavailable';
            errorMsg.style.color = '#d32f2f';
            errorMsg.style.padding = '10px';
            errorMsg.style.textAlign = 'center';
            videoContainer.innerHTML = '';
            videoContainer.appendChild(errorMsg);
        });

        // Optimize performance by pausing videos when not in viewport
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting && !video.paused) {
                    video.pause();
                }
            });
        }, { threshold: 0.5 });

        observer.observe(videoContainer);
    }
}

// Update the createDownloadButton function
function createDownloadButton(counter, quality, link) {
    // Create a container for both buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '5px';

    // Create download button
    const downloadButton = document.createElement('button');
    downloadButton.innerHTML = `${quality} - Download Video ${counter}`;
    downloadButton.id = `dwnVidBtn${counter}`;
    downloadButton.className = 'download-button';
    downloadButton.setAttribute('link', link);
    
    Object.assign(downloadButton.style, {
        padding: '8px 16px',
        fontSize: '14px',
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    });

    downloadButton.addEventListener('click', async function() {
        try {
            const progressBar = this.parentElement.parentElement.querySelector('.progress-bar');
            await downloadVideo(link, progressBar);
        } catch (error) {
            appendLogText(`Download failed: ${error.message}`, 'error');
        }
    });

    // Create open in new tab button
    const openButton = document.createElement('button');
    openButton.innerHTML = '🔗 Open';
    openButton.className = 'open-button';
    openButton.setAttribute('link', link);
    
    Object.assign(openButton.style, {
        padding: '8px 16px',
        fontSize: '14px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    });

    openButton.addEventListener('click', function() {
        try {
            const videoLink = this.getAttribute('link');
            // Clean and open the URL
            const cleanedUrl = cleanVideoUrl(videoLink);
            window.open(cleanedUrl, '_blank');
            appendLogText(`Opening video link in new tab`, 'info');
        } catch (error) {
            appendLogText(`Failed to open link: ${error.message}`, 'error');
        }
    });

    // Add hover effect to both buttons
    [downloadButton, openButton].forEach(button => {
        button.addEventListener('mouseover', function() {
            this.style.opacity = '0.9';
        });
        button.addEventListener('mouseout', function() {
            this.style.opacity = '1';
        });
    });

    buttonContainer.appendChild(downloadButton);
    buttonContainer.appendChild(openButton);
    
    return buttonContainer;
}

// Add a helper function to clean video URLs
function cleanVideoUrl(url) {
    if (!url) return '';
    
    // Remove backslashes
    url = url.replace(/\\/g, '');
    // Replace encoded percent signs
    url = url.replace(/u0025/g, '%');
    // Decode the URL
    try {
        return decodeURIComponent(url);
    } catch (e) {
        appendLogText(`Error decoding URL: ${e.message}`, 'error');
        return url;
    }
}

function createProgressBar() {
    const progress = document.createElement('div');
    progress.className = 'progress-bar';
    Object.assign(progress.style, {
        width: '100%',
        height: '4px',
        backgroundColor: '#ddd',
        marginTop: '4px',
        display: 'none'
    });

    const progressFill = document.createElement('div');
    Object.assign(progressFill.style, {
        width: '0%',
        height: '100%',
        backgroundColor: '#4CAF50',
        transition: 'width 0.3s'
    });

    progress.appendChild(progressFill);
    return progress;
}

async function downloadVideo(url, progressBar) {
    try {
        progressBar.style.display = 'block';
        const response = await fetch(url);
        const reader = response.body.getReader();
        const contentLength = +response.headers.get('Content-Length');
        
        let receivedLength = 0;
        while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            
            receivedLength += value.length;
            const progress = (receivedLength / contentLength) * 100;
            progressBar.firstChild.style.width = `${progress}%`;
        }
        
        appendLogText('Download completed successfully', 'info');
    } catch (error) {
        appendLogText(`Download failed: ${error.message}`, 'error');
        throw error;
    } finally {
        setTimeout(() => {
            progressBar.style.display = 'none';
        }, 1000);
    }
}

async function fetchVideoThumbnail(videoUrl) {
    try {
        // Try to extract thumbnail from video URL or fetch it from Facebook's API
        // This is a placeholder - you'll need to implement the actual thumbnail extraction logic
        return null;
    } catch (error) {
        appendLogText(`Failed to fetch thumbnail: ${error.message}`, 'error');
        return null;
    }
}

function removeAllChildNodes(parentNode){
    appendLogText("Removing child nodes....");
    while (parentNode.firstChild) {
        if(parentNode.firstChild.firstChild){
            removeAllChildNodes(parentNode.firstChild.firstChild);
        }
        parentNode.removeChild(parentNode.lastChild);
    }
}

// Function to update the position of the floating div
function updateFloatingTablePosition() {
    if (videoDownloadPanel.getBoundingClientRect().top > topOffset) {
        videoDownloadPanel.style.top = (videoDownloadPanel.getBoundingClientRect().top - topOffset) + 'px';
        appendLogText("distance to the top: " +videoDownloadPanel.getBoundingClientRect().top);
    } else {
        videoDownloadPanel.style.top = topOffset;
    }
    if (videoDownloadPanel.getBoundingClientRect().left > leftOffset) {
        videoDownloadPanel.style.left = (videoDownloadPanel.getBoundingClientRect().left - leftOffset) + 'px';
    } else {
        videoDownloadPanel.style.left = leftOffset;
    }
}

// Replace the existing appendLogText function
function appendLogText(newLog, type = 'info') {
    try {
        let logText = "";
        
        // Format log with timestamp and type
        const timestamp = new Date().toLocaleTimeString();
        const formattedLog = `[${timestamp}][${type}] ${newLog}`;
        
        // UI Logging
        if (CONFIG.enableUILog && infoPanel) {
            logText = infoPanel.value;
            infoPanel.innerHTML = logText + "\n" + formattedLog;
            
            // Auto-scroll to bottom
            infoPanel.scrollTop = infoPanel.scrollHeight;
        }
        
        // Console Logging
        if (CONFIG.enableConsoleLog) {
            switch(type) {
                case 'error':
                    console.error(formattedLog);
                    break;
                case 'warn':
                    console.warn(formattedLog);
                    break;
                case 'debug':
                    if (CONFIG.debugMode) console.debug(formattedLog);
                    break;
                default:
                    console.log(formattedLog);
            }
        }
    } catch (error) {
        console.error('Logging failed:', error);
    }
}