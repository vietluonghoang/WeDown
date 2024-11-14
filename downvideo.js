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

(function () {
  // Wait until the page fully loaded
  window.addEventListener("load", function () {
    appendLogText("------------\npage loaded....\n------------");
    findPlayVideoInterval = setInterval(checkForLinks, 2000);
  });
})();

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

function appendURL(){
    appendLogText("------------\nStart scanning for links.....\n------------");
    appendLogText("------------\nRun a check for HD.....\n------------");
    // Get the page source of the current page
    let pageSource = document.documentElement.outerHTML;
    // appendLogText("Page Source:\n" + pageSource);
    // Use regex to find string between "progressive_url":" and ","failure_reason":
    let regex =
      /,{"progressive_url":"(.*?)","failure_reason":(.*?),"metadata":{"quality":"HD"}/g; //don't forget "g" param to avoid infinite loop
    let result;
    while(result = regex.exec(pageSource)) {
        // Do something with result[0].
        appendLogText("===== HD video found. Link added");
        let videoLink = result[1];
        appendLogText("Result found : "+ videoLink + " \n\tat index: " + result.index);
        rawVideoLinks.set(videoLink, "HD");
    }
    appendLogText("------------\nRunning another check for SD...\n------------");
    regex = /\[{"progressive_url":"(.*?)","failure_reason":(.*?),"metadata":{"quality":"SD"}/g; //don't forget "g" param to avoid infinite loop
    while(result = regex.exec(pageSource)) {
        // Do something with result[0].
        appendLogText("===== SD video found. Link added");
        let videoLink = result[1];
        appendLogText("Result found : "+ videoLink + " \n\tat index: " + result.index);
        rawVideoLinks.set(videoLink, "SD");
    }

    appendLogText("------------\nRunning another check for different resolutions...\n------------");
    regex = /(?<="base_url":)(.*?)(\])/g; //don't forget "g" param to avoid infinite loop
    let resolutionCounter = 0;
    while(result = regex.exec(pageSource)) {
        // Do something with result[0].
        resolutionCounter++;
        let basedUrl = result[1] + "";
        appendLogText("===== [" + resolutionCounter + "] base url found....\n" + basedUrl);
        let res;
        let videoLink = "";
        let videowidth = 0;
        let videoheight = 0;

        //extract url
        appendLogText("--- Extracting url....");
        let regexExtract = /(?<=")(.*?)","bandwidth/g;
        while(res = regexExtract.exec(basedUrl)) {
            videoLink = res[1];
            appendLogText("video url found...." + videoLink);
        }

        //extract width
        appendLogText("--- Extracting width....");
        regexExtract = /(?<="width":)(.*?),"playback_resolution_mos/g;
        while(res = regexExtract.exec(basedUrl)) {
            videowidth = res[1];
            appendLogText("video width found...." + videowidth);
        }

        //extract height
        appendLogText("--- Extracting height....");
        regexExtract = /(?<="height":)(.*?),"width"/g;
        while(res = regexExtract.exec(basedUrl)) {
            videoheight = res[1];
            appendLogText("video height found...." + videoheight);
        }

        let videoresolution = videoheight + "x" + videowidth;
        appendLogText("- Video resolution: " + videoresolution);
        appendLogText("Result found : "+ videoLink + " \n\tat index: " + result.index);
        rawVideoLinks.set(videoLink, videoresolution);
        //Create the link to the raw video
        // generateLinkButtons(videoresolution, videoLinksPanel, buttonCounter, videoLink);
    }

    if(rawVideoLinks.size > 1){
        //clearInterval(findPlayVideoInterval);
        appendLogText("Finished checking!!!");
        generateLinkButtons();
    }
}

function generateLinkButtons(){
    let buttonCounter = 0;
    appendLogText("Total number of buttons: " + rawVideoLinks.size);

    for (let [videoLink, quality] of rawVideoLinks) {
        buttonCounter++;
        appendLogText("Generating button: \n[" + buttonCounter + "] " + quality + ": " + videoLink);
        
        //check if the get link button is existed
        var getLinksButton = document.getElementById('dwnVidBtn'+buttonCounter);
        if(getLinksButton == null){
            // Create a new button
            getLinksButton = document.createElement("button");

            getLinksButton.innerHTML = quality + " - Get Video Link "+ buttonCounter;
            // Resize the button
            getLinksButton.name = "downVidBtn";
            getLinksButton.id = "dwnVidBtn" + buttonCounter;
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