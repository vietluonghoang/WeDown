// Tamper Monkey Script
// ==UserScript==
// @name         Get Facebook Video Link
// @namespace    http://tampermonkey.net/
// @version      0.1.3
// @description  Simply get the downloadable video facebooklink from the page source
// @author       Viet Cat
// @match        https://www.facebook.com/*
// @grant        none
// ==/UserScript==

var findPlayVideoInterval;
var videoDownloadPanel;
var videoLinksPanel;
var infoPanel;
var rawVideoLinks = [];
var hasStarted = false;
let topOffset;
let leftOffset;
let videoDownloadPanelId = "pnlVidDnl";
let videoLinksPanelId = "pnlVidLk";
let infoPanelID = "pnlInfo";

(function () {
  // Wait until the page fully loaded
  window.addEventListener("load", function () {
    findPlayVideoInterval = setInterval(checkForLinks, 2000);
  });
})();

function checkForLinks(){
    appendLogText("scanning....");
    if(!hasStarted){
        hasStarted = true;
        initComponents();
        appendLogText("Remove all links...");
        rawVideoLinks = [];
        appendURL();
        hasStarted = false;
    }else{
        appendLogText("Scanning is in progress already...");
    }
}

function generateVideoLinksPanel(){
    appendLogText("Generating Video Links panel...");
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
    appendLogText("Generating Info panel...");
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
    appendLogText("Generating Video Download panel...");
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

function appendURL(){
    appendLogText("Start scanning for links.....");
    appendLogText("Run a check for HD.....");
    // Get the page source of the current page
    let pageSource = document.documentElement.outerHTML;
    // Use regex to find string between "playable_url_quality_hd":" and ","spherical_video_fallback_urls"
    let regex =
      /playable_url_quality_hd":"(.*?)","spherical_video_fallback_urls/g; //don't forget "g" param to avoid infinite loop
    let result;
    let buttonCounter = 0;
    while(result = regex.exec(pageSource)) {
        // Do something with result[0].
        appendLogText("HD video found. Link added");
        let videoLink = result[1];
        buttonCounter++;
        appendLogText("Current counter: " + buttonCounter + "\n\tResult found : "+ videoLink + " \nat index: " + result.index);
        rawVideoLinks.push(videoLink);
        //Create the link to the raw video
        generateLinkButtons("HD", videoLinksPanel, buttonCounter, videoLink);
    }
    appendLogText("Running another check for SD...");
    regex = /playable_url":"(.*?)","playable_url_quality_hd/g; //don't forget "g" param to avoid infinite loop
    while(result = regex.exec(pageSource)) {
        // Do something with result[0].
        appendLogText("SD video found. Link added");
        let videoLink = result[1];
        buttonCounter++;
        appendLogText("Current counter: " + buttonCounter + "\n\tResult found : "+ videoLink + " \nat index: " + result.index);
        rawVideoLinks.push(videoLink);
        //Create the link to the raw video
        generateLinkButtons("SD", videoLinksPanel, buttonCounter, videoLink);
    }

    if(rawVideoLinks.length > 1){
        //clearInterval(findPlayVideoInterval);
        appendLogText("Finished checking!!!");
    }
}

function generateLinkButtons(quality, videoLinksPanel, buttonCounter, videoLink){
    appendLogText(quality + " Generating link " + buttonCounter + ": " + videoLink);
    //check if the get link button is existed
    var getLinksButton = document.getElementById('dwnVidBtn'+buttonCounter);
    if(getLinksButton == null){
        // Create a new button
        getLinksButton = document.createElement("button");

        getLinksButton.innerHTML = quality + " - Get Video Link "+ buttonCounter;
        // Resize the button
        getLinksButton.name = "downVidBtn";
        getLinksButton.id = "dwnVidBtn"+buttonCounter;
        getLinksButton.style.position = "relative";
        getLinksButton.style.fontSize = "16px";
        getLinksButton.style.backgroundColor = "green";
        getLinksButton.style.color = "white";
        getLinksButton.style.fontStyle = "bold";
        //Add the button to the panel
        videoLinksPanel.appendChild(getLinksButton);
        //videoLinksPanel.appendChild(document.createElement("br")); //adding linebreak to avoid buttons to overlap each other
        //videoLinksPanel.appendChild(document.createElement("br")); //adding linebreak to avoid buttons to overlap each other
    }
    //update the link for reference
    getLinksButton.setAttribute('link',videoLink);
    // Click on the button will trigger the function
    getLinksButton.addEventListener("click", function () {
      appendLogText("Get Video Link button clicked");
      let vidLink = extractURL(this.getAttribute('link'));
  });
}

/**
 * It takes a video link, removes the \ character, decodes the videoLink where u0025 is %, and opens
 * the link in a new tab
 * @param videoLink - The link to the video
 */
 function extractURL(videoLink) {
  // Remove the \ character from the videoLink
  videoLink = videoLink.replace(/\\/g, "");
  // decode the videoLink where u0025 is %
  videoLink = videoLink.replace(/u0025/g, "%");
  // open the link in a new tab
  window.open(videoLink, "_blank");
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

function appendLogText(newLog){
    var logText = "";
    if(infoPanel != null){
        logText = infoPanel.value
        infoPanel.innerHTML = logText + "\n" + newLog;
    }
    console.log(newLog + "\n" + logText);
}