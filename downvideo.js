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
    // Clear any existing interval to avoid duplicates
    if (findPlayVideoInterval) {
        clearInterval(findPlayVideoInterval);
    }
    findPlayVideoInterval = setInterval(checkForLinks, 2000);
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
    videoLinksPanel.style.height = 'fit-content';
    videoLinksPanel.style.position = 'relative';
    videoLinksPanel.style.margin = '10px 0px';
    videoLinksPanel.style.zIndex = '5000';
    videoLinksPanel.style.display = 'flex';
    videoLinksPanel.style.flexDirection = 'column';
    videoLinksPanel.style.alignItems = 'center';
    videoLinksPanel.style.backgroundColor = 'yellow';

    // Add the links panel to the download panel
    videoDownloadPanel.appendChild(videoLinksPanel);
}

function generateInfoPanel(){
    appendLogText("------------\mGenerating Info panel...\n------------");
    //create a new panel for info
    infoPanel = document.createElement("textarea");
    infoPanel.name = infoPanelID;
    infoPanel.id = infoPanelID;
    infoPanel.style.width = "fit-content";
    infoPanel.style.height = "fit-content";
    infoPanel.style.position = 'relative';
    infoPanel.style.margin = '10px 0px';
    infoPanel.rows = 4;
    infoPanel.cols = 30;
    infoPanel.style.zIndex = "5000";
    infoPanel.style.backgroundColor = "green";

    // Add the links panel to the download panel
    videoDownloadPanel.appendChild(infoPanel);
}

function generateVideoDownloadPanel(){
    appendLogText("------------\nGenerating Video Download panel...\n------------");
    //create a new panel for video download
    videoDownloadPanel = document.createElement("div");
    videoDownloadPanel.name = videoDownloadPanelId;
    videoDownloadPanel.id = videoDownloadPanelId;
    videoDownloadPanel.style.top = "50px";
    videoDownloadPanel.style.left = "50px";
    videoDownloadPanel.style.position = "fixed";
    videoDownloadPanel.style.margin = "10px 0px";
    videoDownloadPanel.style.width = "fit-content";
    videoDownloadPanel.style.height = "fit-content";
    videoDownloadPanel.style.zIndex = "5000";
    videoDownloadPanel.style.display = "flex";
    videoDownloadPanel.style.flexDirection = "column";
    videoDownloadPanel.style.alignItems = 'center';
    // Add the panel to the DOM
    document.body.appendChild(videoDownloadPanel);

    // Set the initial position of the floating div
    topOffset = videoDownloadPanel.offsetTop;
    leftOffset = videoDownloadPanel.offsetLeft;
    // Call the updateFloatingTablePosition function on page load and scroll events
    window.addEventListener('load', updateFloatingTablePosition);
    window.addEventListener('scroll', updateFloatingTablePosition);
}

function initComponents(){
    //check if the panel for video download is existed
    videoDownloadPanel = document.getElementById(videoDownloadPanelId);
    if(videoDownloadPanel == null){
        generateVideoDownloadPanel();
    }else{
        removeAllChildNodes(videoDownloadPanel);
    }

    //check if the panel for all link is existed
    videoLinksPanel = document.getElementById(videoLinksPanelId);
    if(videoLinksPanel == null){
        generateVideoLinksPanel();
    }else{
        removeAllChildNodes(videoLinksPanel);
    }

    //check if the panel for info is existed
    infoPanel = document.getElementById(infoPanelID);
    if(infoPanel == null){
        generateInfoPanel();
    }else{
        removeAllChildNodes(infoPanel);
    }
}

function appendURL() {
    try {
        appendLogText("Starting video link scan", 'info');
        const pageSource = document.documentElement.outerHTML;
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
        
        // Create container for button and thumbnail
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.margin = '5px';
        container.style.padding = '5px';
        container.style.backgroundColor = '#f0f0f0';
        container.style.borderRadius = '5px';

        // Create thumbnail if available
        const thumbnail = document.createElement('div');
        thumbnail.style.width = '120px';
        thumbnail.style.height = '67px';
        thumbnail.style.marginRight = '10px';
        thumbnail.style.backgroundColor = '#ddd';
        thumbnail.style.backgroundSize = 'cover';
        thumbnail.style.backgroundPosition = 'center';
        
        // Try to get video thumbnail
        fetchVideoThumbnail(videoLink).then(thumbnailUrl => {
            if (thumbnailUrl) {
                thumbnail.style.backgroundImage = `url(${thumbnailUrl})`;
            }
        });

        // Create button with progress bar
        const buttonWrapper = document.createElement('div');
        buttonWrapper.style.position = 'relative';
        
        const button = createDownloadButton(buttonCounter, quality, videoLink);
        const progressBar = createProgressBar();
        
        buttonWrapper.appendChild(button);
        buttonWrapper.appendChild(progressBar);
        
        container.appendChild(thumbnail);
        container.appendChild(buttonWrapper);
        videoLinksPanel.appendChild(container);
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