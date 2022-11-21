// Tamper Monkey Script
// ==UserScript==
// @name         Get Video Link Test
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @description  Simply get the downloadable video facebooklink from the page source
// @author       HoangNB
// @match        https://www.facebook.com/*
// @grant        none
// ==/UserScript==
(function () {
  // Wait until the page fully loaded
  window.addEventListener("load", function () {
  	var findPlayVideoInterval = setInterval(generateLinksPanel, 1000);
  });
})();

function generateLinksPanel(){
    // Find a div with aria-label="Play Video"
    var playButton = document.querySelector('div[aria-label="Play Video"]');

    //check if the panel for all link is existed
    var videoLinksPanel = document.getElementById('pnlVidLk');
    if(videoLinksPanel == null){
        //create a new panel for all links
        videoLinksPanel = document.createElement("div");
        videoLinksPanel.name = "pnlVideoLinks";
        videoLinksPanel.id = "pnlVidLk";
        videoLinksPanel.style.position = "fixed";
        videoLinksPanel.style.top = "50px";
        videoLinksPanel.style.left = "50px";
        videoLinksPanel.style.width = "fit-content";
        videoLinksPanel.style.height = "fit-content";
        videoLinksPanel.style.zIndex = "5000";
        videoLinksPanel.style.backgroundColor = "yellow";
         // Add the panel to the DOM
        document.body.appendChild(videoLinksPanel);
 	}else{
 		//Action for link panel
    }

    if (playButton) {
        console.log("Play Video found!");
        //remove all old elements
        if(videoLinksPanel != null){
	     	removeAllChildNodes(videoLinksPanel);
	    }else{
	    	//Action for link panel
	    }
	    //Append URL to button
	    appendURL(videoLinksPanel);
    }else{
  		console.log("No Play Video found!!!");
  		if(videoLinksPanel != null){
	     	removeAllChildNodes(videoLinksPanel);
     		let emptyText = document.createElement("p");
     		emptyText.innerHTML = "No link available";
     		videoLinksPanel.appendChild(emptyText);
 		}else{
 			//Action for link panel
 		}
    }
}

function appendURL(videoLinksPanel){
    // Get the page source of the current page
    let pageSource = document.documentElement.outerHTML;
    // Use regex to find string between "playable_url_quality_hd":" and ","spherical_video_fallback_urls"
    let regex =
      /playable_url_quality_hd":"(.*?)","spherical_video_fallback_urls/g; //don't forget "g" param to avoid infinite loop
    let result;
    let buttonCounter = 0;
    while(result = regex.exec(pageSource)) {
        // Do something with result[0].
        let videoLink = result[1];
        buttonCounter++;
        console.log("Current counter: " + buttonCounter);
        console.log("result found : "+ videoLink + " at index: " + result.index);
        generateLinkButtons(videoLinksPanel, buttonCounter, videoLink)
    }
    if (result == null){
      	console.log("No HD video found. Running another check...");
        let regex = /playable_url":"(.*?)","playable_url_quality_hd/g; //don't forget "g" param to avoid infinite loop
        buttonCounter = 0;
        while(result = regex.exec(pageSource)) {
            // Do something with result[0].
            let videoLink = result[1];
            buttonCounter++;
            console.log("Current counter: " + buttonCounter);
            console.log("result found : "+ videoLink + " at index: " + result.index);
            generateLinkButtons(videoLinksPanel, buttonCounter, videoLink)
        }
    }else{
      	console.log("HD video found. Link added");
    }
}

function generateLinkButtons(videoLinksPanel, buttonCounter, videoLink){
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
        videoLinksPanel.appendChild(getLinksButton);
        videoLinksPanel.appendChild(document.createElement("p")); //adding linebreak to avoid buttons to overlap each other
        videoLinksPanel.appendChild(document.createElement("br")); //adding linebreak to avoid buttons to overlap each other
    }
    //update the link for reference
    getLinksButton.setAttribute('link',videoLink);
    // Click on the button will trigger the function
    getLinksButton.addEventListener("click", function () {
    	console.log("Get Video Link button clicked");
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
	while (parentNode.firstChild) {
		parentNode.removeChild(parentNode.lastChild);
	}
}