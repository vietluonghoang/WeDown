// ==UserScript==
// @name         Get tiktok video
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @description  try to take over the world!
// @author       You
// @match        https://www.tiktok.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

let findPlayVideoInterval;
var hasStarted = false;
var hasFinished = false;
var videoLinksPanel;
let topOffset;
let leftOffset;
let links = [];
let downloadLinks = [];
let videoPageWindows = [];

(function () {
     console.log('down toptop enabled');
  // Wait until the page fully loaded then trigger the scan for video
  window.addEventListener("load", function () {
    findPlayVideoInterval = setInterval(getVideoLinks, 1000);
  });
})();

function getVideoLinks(){
    //keep checking until the scan for video page finished
    if(!hasFinished){
        //if the scan process hasn't started, start it
        if(!hasStarted){
            hasStarted = true;
            console.log('A new round started');
            scrollToBottom();
        }else{
            console.log('A new round has started already');
        }
    }else{
        //once the scan for video page finished, run the second scan for downloadable video
        console.log('A new round has finished');
        clearInterval(findPlayVideoInterval); //remove the regular check for the first scan
        if(links.length > 0){
            getDownloadLinkFromVideo(0); //start the second scan with the first video page
        }else {
            console.log('No video found');
        }
    }
}

function collectLinks() {
    //find all a tag then get the link that includes "/video/"
    console.log('collecting links');
    const allLinks = document.getElementsByTagName("a");
    for (let i = 0; i < allLinks.length; i++) {
        const link = allLinks[i].href;
        if (link.includes("/video/")) {
            links.push(link); //push all links to an array
        }
    }
    hasFinished = true;
}

//get the video page from the array by taking the one with the specified index
function getDownloadLinkFromVideo(index){
    var videoLink = links[index]; //link to the video page
    console.log("=== Checking link: " + videoLink + " with index of: " + index);
    //remove video page to save space and memory. Don't remove the last one. The removal happens a bit too early then it causes all tabs to stop working
    while(videoPageWindows.length > 1 ){
        console.log("=== Video pages left: " + videoPageWindows.length);
        videoPageWindows.shift().close();
    }
    //only process if the it's actually the video page, which includes the domain name and "video".
    //TODO: remove the redundent check for raw video pages, which often are in this form "https://v16-webapp-prime.tiktok.com/video/"
    if (videoLink.includes("video") && videoLink.includes("tiktok.com")){
        console.log("=== Opening link: " + videoLink);
        const newTab = window.open(links[index]); //open the video page in a new tab
        videoPageWindows.push(newTab); //add the tab to an array for removal later
        newTab.window.addEventListener("load", function () { // add an delay until the page is fully loaded
            console.log("=========== Getting video page source ============");
            const pageSource = newTab.document.documentElement.outerHTML;
            console.log(pageSource);
            const allDownloadLinks = newTab.document.getElementsByTagName("video"); //the link to raw video can be gathered from the video tag. However it's not working when the raw video is under this domain "https://webapp-va.tiktok.com/"
            for (let i = 0; i < allDownloadLinks.length; i++) {
                const dLink = allDownloadLinks[i].src.replace(/amp;/g, "");
                console.log("=========== Download links found: " + dLink);
                downloadLinks.push(dLink); //suppose to have only 1 link but we should use this type of iteration to avoid edge cases
            }
            console.log("=========== Download links ============\n" + downloadLinks.map(link => `${link}`).join("\n"));
            console.log("=========== Opening Download links: " + downloadLinks[index]);
            const rawVideoTab = window.open(downloadLinks[index]); //open the raw video link in new tab
            if(index < links.length){ //if there are video page available, make another call with the index increased by 1
                console.log("=========== There are more video to download =======");
                getDownloadLinkFromVideo(index + 1);
            }else{
                console.log("=========== No more video to download =======");
            }
        });
    }else {
        console.log("=========== Link to the page is not the right one: " + links[index]);
    }
}

function scrollToBottom() {
    //if the page is video page, no need to scroll.
    if(window.location.href.includes("video")){
        console.log('Video page. No scroll needed!');
        clearInterval(findPlayVideoInterval); //remove the regular check for the first scan
        var dlLinks = [];
        const allDownloadLinks = document.getElementsByTagName("video"); //the link to raw video can be gathered from the video tag. However it's not working when the raw video is under this domain "https://webapp-va.tiktok.com/"
        for (let i = 0; i < allDownloadLinks.length; i++) {
            const dLink = allDownloadLinks[i].src.replace(/amp;/g, "");
            console.log("=========== Download links found: " + dLink);
            dlLinks.push(dLink); //suppose to have only 1 link but we should use this type of iteration to avoid edge cases
        }
        console.log("=========== Download links ============\n" + dlLinks.map(link => `${link}`).join("\n"));
        generateVideoLinkPanel(dlLinks); //add the raw video link in floating div
    }else{
        //scroll the profile pages to the bottom no matter what
        window.scrollTo(0, document.body.scrollHeight);
        console.log('first scroll');
        //scroll the the bottom of the page after 2 seconds
        setTimeout(() => {
            const previousHeight = document.body.scrollHeight;
            window.scrollTo(0, document.body.scrollHeight);
            console.log('next scroll');
            //wait for 3 seconds for the page to load if more videos available
            setTimeout(() => {
                //if there are more videos loaded, keep scrolling
                if (document.body.scrollHeight > previousHeight) {
                    scrollToBottom();
                } else { //if no more video loaded, scan the page to get all links to video pages
                    collectLinks();
                    console.log("=========== Video links ============\n" + links.map(link => `${link}`).join("\n"));
                }
            }, 3000);
        }, 2000);
    }
}

function generateVideoLinkPanel(rawVideoLinks){
    //check if the panel for all link is existed
    videoLinksPanel = document.getElementById('pnlVidLk');
    if(videoLinksPanel == null){
        //create a new panel for all links
        videoLinksPanel = document.createElement("div");
        videoLinksPanel.name = "pnlVideoLinks";
        videoLinksPanel.id = "pnlVidLk";
        videoLinksPanel.style.position = "fixed";
        videoLinksPanel.style.top = "50px";
        videoLinksPanel.style.left = "250px";
        videoLinksPanel.style.width = "fit-content";
        videoLinksPanel.style.height = "fit-content";
        videoLinksPanel.style.zIndex = "5000";
        videoLinksPanel.style.backgroundColor = "yellow";
        // Add the panel to the DOM
        document.body.appendChild(videoLinksPanel);
    }else{
        removeAllChildNodes(videoLinksPanel);
    }
    //Create the link to the raw video
    for(var i=0;i<rawVideoLinks.length;i++){
        generateLinkButtons(videoLinksPanel, i, rawVideoLinks[i]);
    }
    // Set the initial position of the floating div
    topOffset = videoLinksPanel.offsetTop;
    leftOffset = videoLinksPanel.offsetLeft;
    // Call the updateFloatingTablePosition function on page load and scroll events
    window.addEventListener('load', updateFloatingTablePosition);
    window.addEventListener('scroll', updateFloatingTablePosition);
}

function generateLinkButtons(videoLinksPnl, buttonCounter, videoLink){
    //check if the get link button is existed
    var getLinksButton = document.getElementById('dwnVidBtn'+buttonCounter);
    if(getLinksButton == null){
        // Create a new button
        getLinksButton = document.createElement("button");

        getLinksButton.innerHTML = "Get Video Link "+ buttonCounter;
        // Resize the button
        getLinksButton.name = "downVidBtn";
        getLinksButton.id = "dwnVidBtn"+buttonCounter;
        getLinksButton.style.position = "fixed";
        getLinksButton.style.fontSize = "16px";
        getLinksButton.style.backgroundColor = "green";
        getLinksButton.style.color = "white";
        getLinksButton.style.fontStyle = "bold";
        //Add the button to the panel
        videoLinksPnl.appendChild(getLinksButton);
        videoLinksPnl.appendChild(document.createElement("br")); //adding linebreak to avoid buttons to overlap each other
        videoLinksPnl.appendChild(document.createElement("br")); //adding linebreak to avoid buttons to overlap each other
    }
    //update the link for reference
    getLinksButton.setAttribute('link',videoLink);
    // Click on the button will trigger the function
    getLinksButton.addEventListener("click", function () {
        let vidLink = extractURL(this.getAttribute('link'));
        console.log("Get Video Link button clicked: " + vidLink);
  });
}

function removeAllChildNodes(parentNode){
  while (parentNode.firstChild) {
    parentNode.removeChild(parentNode.lastChild);
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

// Function to update the position of the floating div
function updateFloatingTablePosition() {
    if (videoLinksPanel.getBoundingClientRect().top > topOffset) {
        videoLinksPanel.style.top = (videoLinksPanel.getBoundingClientRect().top - topOffset) + 'px';
        console.log("distance to the top: " +videoLinksPanel.getBoundingClientRect().top);
    } else {
        videoLinksPanel.style.top = topOffset;
    }
    if (videoLinksPanel.getBoundingClientRect().left > leftOffset) {
        videoLinksPanel.style.left = (videoLinksPanel.getBoundingClientRect().left - leftOffset) + 'px';
    } else {
        videoLinksPanel.style.left = leftOffset;
    }
}