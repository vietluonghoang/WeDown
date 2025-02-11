// Tamper Monkey Script
// ==UserScript==
// @name         Get Facebook Video Link
// @namespace    http://tampermonkey.net/
// @version      0.1.8
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

// Add near the top with other constants
const DEBOUNCE_DELAY = 100;

// Add near the top with other constants
const RATE_LIMIT = {
    MAX_CONCURRENT_DOWNLOADS: 3,
    COOLDOWN_PERIOD: 2000 // 2 seconds
};

// Add to the top with other constants
const LOADING_STATES = {
    DOTS_COUNT: 3,
    INTERVAL: 500, // 500ms between dots updates
};

// Add these variables
let activeDownloads = 0;
let downloadQueue = [];

// Add this utility function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function cleanup() {
    if (findPlayVideoInterval) {
        clearInterval(findPlayVideoInterval);
    }
    if (observer) {
        observer.disconnect();
    }
    
    // Clean up video elements and their observers
    document.querySelectorAll('video').forEach(video => {
        video.pause();
        video.src = '';
        video.load();
    });
    
    // Remove existing panels if they exist
    const existingPanel = document.getElementById(videoDownloadPanelId);
    if (existingPanel) {
        existingPanel.remove();
    }
    
    // Clear stored links
    rawVideoLinks.clear();
}

(function () {
    cleanup(); // Clean up any existing instances
    initializeScript(); // Initialize immediately

    // Create the observer for future navigation
    observer = new MutationObserver((mutations) => {
        if (!document.getElementById(videoDownloadPanelId)) {
            initializeScript();
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Handle cleanup when navigating away
    window.addEventListener('beforeunload', cleanup);
})();

function initializeScript() {
    // Create panel immediately
    initComponents();
    appendLogText("------------\npage loaded....\n------------");
    
    // Stop any existing search
    stopSearchInterval();
    
    // Start first scan immediately
    checkForLinks();
    
    // Set up interval for subsequent scans
    const interval = rawVideoLinks.size > 0 ? INTERVALS.AFTER_FOUND : INTERVALS.DEFAULT;
    findPlayVideoInterval = setInterval(checkForLinks, interval);
}

function checkForLinks() {
    appendLogText("------------\nscanning....\n------------");
    // Only proceed if we're not already scanning and the interval is active
    if (!hasStarted && findPlayVideoInterval) {
        hasStarted = true;
        appendLogText("Remove all links...");
        rawVideoLinks = new Map();
        appendURL();
        hasStarted = false;
    } else {
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

function generateVideoDownloadPanel() {
    appendLogText("------------\nGenerating Video Download panel...\n------------");
    
    videoDownloadPanel = document.createElement("div");
    videoDownloadPanel.name = videoDownloadPanelId;
    videoDownloadPanel.id = videoDownloadPanelId;
    Object.assign(videoDownloadPanel.style, {
        top: "20px",
        right: "20px", // Keep panel anchored to the right
        position: "fixed",
        margin: "0",
        width: "520px", // Default width with toggle
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "row",
        zIndex: "9999",
        backgroundColor: "#ffffff",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        borderRadius: "8px",
        overflow: "visible" // Allow info panel to expand outside
    });

    // Create info section (left side)
    const infoSection = createInfoSection();
    
    // Create main content container (right side)
    const mainContent = document.createElement('div');
    Object.assign(mainContent.style, {
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        width: '500px',
        minWidth: '500px'
    });

    // Add sections to main content
    const headerBar = createHeaderBar();
    headerBar.classList.add('header-bar');
    const contentContainer = createContentContainer();
    
    mainContent.appendChild(headerBar);
    mainContent.appendChild(contentContainer);
    
    videoDownloadPanel.appendChild(infoSection);
    videoDownloadPanel.appendChild(mainContent);
    
    document.body.appendChild(videoDownloadPanel);
    makeDraggable(videoDownloadPanel, headerBar);
}

function createHeaderBar() {
    const headerBar = document.createElement('div');
    Object.assign(headerBar.style, {
        width: '100%',
        backgroundColor: '#4a76a8',
        color: 'white',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px 8px 0 0',
        cursor: 'move'
    });

    // Title section
    const titleSection = document.createElement('div');
    Object.assign(titleSection.style, {
        padding: '12px 15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
    });

    const title = document.createElement('span');
    title.textContent = 'Video Downloader';
    title.style.fontWeight = '600';
    title.style.fontSize = '14px';

    const toggleButton = createToggleButton();
    
    titleSection.appendChild(title);
    titleSection.appendChild(toggleButton);

    // Search control section
    const searchSection = document.createElement('div');
    Object.assign(searchSection.style, {
        padding: '10px 15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.1)'
    });

    const searchControl = createSearchControl();
    searchSection.appendChild(searchControl);

    headerBar.appendChild(titleSection);
    headerBar.appendChild(searchSection);
    
    return headerBar;
}

function createToggleButton() {
    const button = document.createElement('button');
    button.innerHTML = '▼'; // Down arrow for expanded state
    Object.assign(button.style, {
        background: 'none',
        border: 'none',
        color: 'white',
        fontSize: '16px',
        cursor: 'pointer',
        padding: '0 5px',
        lineHeight: '1',
        opacity: '0.8',
        transition: 'transform 0.3s ease'
    });
    
    let isExpanded = true;
    
    button.addEventListener('mouseover', () => button.style.opacity = '1');
    button.addEventListener('mouseout', () => button.style.opacity = '0.8');
    button.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent dragging when clicking the button
        
        const panel = document.getElementById(videoDownloadPanelId);
        const videosContainer = document.getElementById(videoLinksPanelId);
        const infoContainer = document.getElementById(infoPanelID)?.parentElement;
        const searchSection = button.closest('.header-bar')?.querySelector('div:nth-child(2)');
        
        if (isExpanded) {
            // Collapse
            if (videosContainer) videosContainer.style.display = 'none';
            if (infoContainer) infoContainer.style.display = 'none';
            if (searchSection) searchSection.style.display = 'none';
            button.innerHTML = '▲'; // Up arrow for collapsed state
            button.style.transform = 'rotate(180deg)';
            
            // Store current height before collapsing
            panel.dataset.expandedHeight = panel.style.height;
            panel.style.height = 'auto';
        } else {
            // Expand
            if (videosContainer) videosContainer.style.display = 'block';
            if (infoContainer) infoContainer.style.display = 'flex'; // Changed to flex
            if (searchSection) searchSection.style.display = 'flex';
            button.innerHTML = '▼'; // Down arrow for expanded state
            button.style.transform = 'rotate(0deg)';
            
            // Restore previous height if it was stored
            if (panel.dataset.expandedHeight) {
                panel.style.height = panel.dataset.expandedHeight;
            }
        }
        
        isExpanded = !isExpanded;
    });
    
    return button;
}

function createContentContainer() {
    const container = document.createElement('div');
    Object.assign(container.style, {
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        padding: '10px',
        height: 'calc(90vh - 100px)', // Adjust based on header height
        boxSizing: 'border-box',
        overflow: 'hidden' // Ensure content doesn't overflow
    });

    // Create videos panel section
    const videosSection = createVideosSection();
    container.appendChild(videosSection);
    
    return container;
}

function createInfoSection() {
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'absolute',
        right: '100%', // Position to the left of the main panel
        top: '0',
        height: '100%',
        width: '20px',
        display: 'flex',
        flexDirection: 'row',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
        borderRadius: '8px 0 0 8px', // Round left corners
        boxShadow: '-2px 0 5px rgba(0,0,0,0.1)' // Add shadow on the left
    });

    // Create toggle button container
    const toggleContainer = document.createElement('div');
    Object.assign(toggleContainer.style, {
        width: '20px',
        minWidth: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
        cursor: 'pointer',
        borderRight: '1px solid #dee2e6',
        zIndex: '1'
    });

    const toggleButton = document.createElement('div');
    Object.assign(toggleButton.style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 0',
        userSelect: 'none',
        color: '#666',
        fontSize: '14px',
        fontWeight: 'bold'
    });

    // Create info icon
    const infoIcon = document.createElement('span');
    infoIcon.textContent = 'ℹ';
    Object.assign(infoIcon.style, {
        fontSize: '14px'
    });

    // Create arrow
    const arrow = document.createElement('span');
    arrow.textContent = '►';
    Object.assign(arrow.style, {
        fontSize: '12px',
        transition: 'transform 0.3s ease'
    });

    toggleButton.appendChild(infoIcon);
    toggleButton.appendChild(arrow);

    // Create info panel container
    const infoPanelContainer = document.createElement('div');
    Object.assign(infoPanelContainer.style, {
        width: '300px',
        minWidth: '300px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa',
        borderRight: '1px solid #dee2e6'
    });

    // Create info panel
    infoPanel = document.createElement('textarea');
    infoPanel.id = infoPanelID;
    Object.assign(infoPanel.style, {
        flex: '1',
        width: '100%',
        height: '100%',
        padding: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        border: 'none',
        resize: 'none',
        backgroundColor: '#f8f9fa',
        boxSizing: 'border-box'
    });
    
    let isExpanded = false;
    const toggleInfoPanel = () => {
        isExpanded = !isExpanded;
        container.style.width = isExpanded ? '320px' : '20px';
        arrow.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
    };

    toggleContainer.addEventListener('click', toggleInfoPanel);
    
    infoPanelContainer.appendChild(infoPanel);
    toggleContainer.appendChild(toggleButton);
    container.appendChild(toggleContainer);
    container.appendChild(infoPanelContainer);
    
    // Observer to maintain textarea height when panel is expanded
    const resizeObserver = new ResizeObserver(() => {
        if (isExpanded) {
            const containerHeight = container.clientHeight;
            infoPanel.style.height = `${containerHeight}px`;
        }
    });
    
    resizeObserver.observe(container);
    
    return container;
}

function createVideosSection() {
    const container = document.createElement('div');
    Object.assign(container.style, {
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden'
    });

    videoLinksPanel = document.createElement('div');
    videoLinksPanel.id = videoLinksPanelId;
    Object.assign(videoLinksPanel.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '5px'
    });

    // Add initial loading state
    showLoadingState(videoLinksPanel);
    
    container.appendChild(videoLinksPanel);
    return container;
}

function showLoadingState(container) {
    // Create loading container
    const loadingContainer = document.createElement('div');
    Object.assign(loadingContainer.style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: '#666',
        height: '100px'
    });
    
    // Add loading text
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Searching';
    loadingText.style.marginBottom = '10px';
    loadingText.style.fontSize = '14px';
    
    // Add dots container
    const dots = document.createElement('span');
    dots.style.fontSize = '20px';
    dots.style.letterSpacing = '4px';
    
    loadingContainer.appendChild(loadingText);
    loadingContainer.appendChild(dots);
    
    // Clear container and add loading elements
    removeAllChildNodes(container);
    container.appendChild(loadingContainer);
    
    // Animate dots
    let dotCount = 0;
    const updateDots = () => {
        dots.textContent = '.'.repeat(dotCount + 1);
        dotCount = (dotCount + 1) % LOADING_STATES.DOTS_COUNT;
    };
    
    updateDots(); // Initial dots
    const dotsInterval = setInterval(updateDots, LOADING_STATES.INTERVAL);
    
    // Store interval ID in container dataset for cleanup
    container.dataset.loadingInterval = dotsInterval;
}

function clearLoadingState(container) {
    const intervalId = container.dataset.loadingInterval;
    if (intervalId) {
        clearInterval(parseInt(intervalId));
        delete container.dataset.loadingInterval;
    }
}

function createSearchControl() {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '10px';
    container.style.width = '100%';

    const button = document.createElement('button');
    button.id = 'searchControlBtn';
    Object.assign(button.style, {
        padding: '5px 10px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        backgroundColor: '#4CAF50',
        color: 'white',
        fontSize: '13px'
    });

    const countdownText = document.createElement('span');
    countdownText.id = 'searchCountdown';
    countdownText.style.color = 'rgba(255,255,255,0.8)';
    countdownText.style.fontSize = '13px';
    
    container.appendChild(button);
    container.appendChild(countdownText);

    let countdownInterval;
    
    function updateButtonState(isSearching) {
        if (isSearching) {
            button.textContent = 'Stop Searching';
            button.style.backgroundColor = '#4CAF50'; // Green for active
            
            // Reset state when starting new search
            rawVideoLinks.clear(); // Clear existing links to reset timer to 2s
            hasStarted = false;    // Reset search state
            
            // Start new search cycle
            stopSearchInterval(); // Clear any existing interval
            checkForLinks(); // Immediate search
            findPlayVideoInterval = setInterval(checkForLinks, INTERVALS.DEFAULT); // Always start with 2s interval
            
            startCountdown();
        } else {
            button.textContent = 'Start Searching';
            button.style.backgroundColor = '#f44336'; // Red for inactive
            stopSearchInterval();
            stopCountdown();
        }
    }

    function startCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        // Always start with DEFAULT interval (2s) when manually starting
        let countdown = INTERVALS.DEFAULT / 1000;

        // Update immediately
        countdownText.textContent = `Next scan in ${countdown}s`;

        countdownInterval = setInterval(() => {
            countdown--;
            if (countdown <= 0) {
                countdown = rawVideoLinks.size > 0 ? 
                    INTERVALS.AFTER_FOUND / 1000 : 
                    INTERVALS.DEFAULT / 1000;
            }
            if (findPlayVideoInterval) { // Only update if search is active
                countdownText.textContent = `Next scan in ${countdown}s`;
            }
        }, 1000);
    }

    function stopCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        countdownText.textContent = 'Search stopped';
    }

    button.addEventListener('click', () => {
        updateButtonState(!findPlayVideoInterval);
    });

    // Set initial state
    updateButtonState(true);
    
    return container;
}

function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        const newTop = element.offsetTop - pos2;
        const newLeft = element.offsetLeft - pos1;
        
        // Keep within viewport bounds
        const maxTop = window.innerHeight - element.offsetHeight;
        const maxLeft = window.innerWidth - element.offsetWidth;
        
        element.style.top = `${Math.min(Math.max(0, newTop), maxTop)}px`;
        element.style.left = `${Math.min(Math.max(0, newLeft), maxLeft)}px`;
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

function initComponents() {
    videoDownloadPanel = document.getElementById(videoDownloadPanelId);
    if (videoDownloadPanel == null) {
        generateVideoDownloadPanel();
    }
    
    const videoLinksPanel = document.getElementById(videoLinksPanelId);
    if (videoLinksPanel) {
        showLoadingState(videoLinksPanel);
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
                countdownText.textContent = `Next scan in ${INTERVALS.AFTER_FOUND / 1000}s`;
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
        
        // Extended list of valid domains
        const validDomains = [
            'fbcdn.net',
            'facebook.com',
            'fbsbx.com',
            'fb.watch',
            'fb.gg'
        ];
        
        // Check for valid domain
        const isValidDomain = validDomains.some(domain => 
            urlObj.hostname.toLowerCase().includes(domain));
        
        // Check for valid video path
        const hasValidPath = /\.(mp4|mov|m4v)($|\?)|\/video\/|\/fbcdn\//.test(urlObj.pathname);
        
        return urlObj.protocol === 'https:' && 
               isValidDomain && 
               hasValidPath;
    } catch (error) {
        appendLogText(`Invalid URL: ${error.message}`, 'debug');
        return false;
    }
}

function generateLinkButtons() {
    let buttonCounter = 0;
    appendLogText(`Generating buttons for ${rawVideoLinks.size} videos`, 'info');

    const videoLinksPanel = document.getElementById(videoLinksPanelId);
    if (!videoLinksPanel) {
        appendLogText('Video links panel not found', 'error');
        return;
    }

    clearLoadingState(videoLinksPanel);
    removeAllChildNodes(videoLinksPanel);

    if (rawVideoLinks.size === 0) {
        const noVideosMsg = document.createElement('div');
        Object.assign(noVideosMsg.style, {
            padding: '20px',
            textAlign: 'center',
            color: '#666',
            fontSize: '14px'
        });
        noVideosMsg.textContent = 'No videos found on this page';
        videoLinksPanel.appendChild(noVideosMsg);
        return;
    }

    for (let [videoLink, quality] of rawVideoLinks) {
        buttonCounter++;
        
        const container = document.createElement('div');
        Object.assign(container.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px',
            backgroundColor: '#f0f0f0',
            borderRadius: '5px',
            width: '100%',
            boxSizing: 'border-box'
        });

        const videoContainer = document.createElement('div');
        Object.assign(videoContainer.style, {
            height: '100px',
            width: '178px',
            flexShrink: '0',
            position: 'relative',
            overflow: 'hidden'
        });

        const video = document.createElement('video');
        Object.assign(video.style, {
            height: '100%',
            width: '100%',
            objectFit: 'contain',
            borderRadius: '4px',
            backgroundColor: '#000'
        });
        video.controls = true;
        video.preload = 'metadata';
        video.muted = true;

        // Clean the video URL
        const cleanedUrl = cleanVideoUrl(videoLink);
        video.src = cleanedUrl;

        videoContainer.appendChild(video);

        // Create button container for right alignment
        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            marginLeft: 'auto', // Push to right
            display: 'flex',
            alignItems: 'center'
        });

        // Create open button
        const button = document.createElement('button');
        button.innerHTML = `${quality} - Open Video ${buttonCounter} 🔗`;
        Object.assign(button.style, {
            padding: '8px 16px',
            fontSize: '14px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            whiteSpace: 'nowrap' // Prevent button text from wrapping
        });

        // Add hover effect
        button.addEventListener('mouseover', () => button.style.opacity = '0.9');
        button.addEventListener('mouseout', () => button.style.opacity = '1');

        // Add click handler
        button.addEventListener('click', () => {
            try {
                window.open(cleanedUrl, '_blank');
                appendLogText(`Opening video link in new tab`, 'info');
            } catch (error) {
                appendLogText(`Failed to open link: ${error.message}`, 'error');
            }
        });
        
        buttonContainer.appendChild(button);
        container.appendChild(videoContainer);
        container.appendChild(buttonContainer);
        videoLinksPanel.appendChild(container);

        // Handle video errors
        video.addEventListener('error', () => {
            appendLogText(`Failed to load video ${buttonCounter}`, 'error');
            videoContainer.style.backgroundColor = '#ffebee';
            const errorMsg = document.createElement('div');
            Object.assign(errorMsg.style, {
                color: '#d32f2f',
                padding: '10px',
                textAlign: 'center',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            });
            errorMsg.textContent = 'Video preview unavailable';
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
        // Get the info panel element
        const infoPanel = document.getElementById(infoPanelID);
        if (!infoPanel) {
            console.warn('Info panel not found');
            return;
        }
        
        // Format log with timestamp and type
        const timestamp = new Date().toLocaleTimeString();
        const formattedLog = `[${timestamp}][${type}] ${newLog}`;
        
        // UI Logging
        if (CONFIG.enableUILog) {
            // Add new log to existing content
            infoPanel.value = infoPanel.value 
                ? infoPanel.value + '\n' + formattedLog 
                : formattedLog;
            
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

// Add this function to handle all interval cleanup
function stopSearchInterval() {
    if (findPlayVideoInterval) {
        clearInterval(findPlayVideoInterval);
        findPlayVideoInterval = null;
    }
    hasStarted = false; // Reset the search state flag
}