// ==UserScript==
// @name         Facebook Autocomment
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Auto send comments to someone's friends
// @author       Viet Cat
// @match        https://www.facebook.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// ==/UserScript==

let targetId = "100015194531595";
let commentContent = "quá hay luôn";
var friendsListCheckInterval;
var friendUrls = [];

(function () {
  // Wait until the page fully loaded
  window.addEventListener("load", function () {
    friendsListCheckInterval = setInterval(commentThemAll, 3000);
  });
})();

function getElementByXpath(contextNode, path) {
  if(contextNode == null){
      contextNode = document;
  }
  return document.evaluate(path, contextNode, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null );
}

function openLink(url){
    window.open(url,"_self");
}

function commentThemAll(){
    clearInterval(friendsListCheckInterval); //remove the regular check for the first scan
    if(window.location.href.includes("friends")){
        if (confirm("Spam now?")) {
            console.log('Spam now....');
            getFriendsList();
        } else {
            console.log('You decided not to spam.');
        }
    }else{
        var expectedXpath = "//a[contains('" + window.location.href + "/',@href) and ./div/span[contains(text(),'Posts')]]"
        var postsTag = getElementByXpath(null, expectedXpath).snapshotLength;
        if(postsTag > 0){
            console.log("--- found profile page: " + window.location.href);
            putComment();
        }else{
            console.log("--- not a profile page: " + window.location.href + "\n" + expectedXpath);
        }
    }
}

function getFriendsList(){
    scrollToBottom();
    //var friendsHeader = getElementByXpath("//a[contains(text(),'Friends')]");
}

function putComment(){
    var counter = 0;
    console.log("--- time to put comment now");
    setTimeout(() => {
        var commentBoxXpath = "//div[./div/div/ul/li/span/div[@aria-label='Comment with an avatar sticker']]/div/div/div/div";
        var commentBoxes = getElementByXpath(null, commentBoxXpath);
        console.log("--- comment boxes available: " + commentBoxes.snapshotLength);
        scrollToElement(commentBoxes.snapshotItem(counter));
        console.log(commentBoxes.snapshotItem(counter));
        commentBoxes.snapshotItem(counter).click();
        commentBoxes.snapshotItem(counter).focus();
        setTimeout(() => {
            simulateKeyPress(commentBoxes.snapshotItem(counter),"c");
        }, 2000);
    }, 2000);

    /*
    for ( var i=0 ; i < commentBoxes.snapshotLength; i++ ){
        console.log(commentBoxes.snapshotItem(i));
        scrollToElement(commentBoxes.snapshotItem(i));
        //commentBoxes.snapshotItem(i).click();
        //delay(1000).then(() => console.log('ran after 1 second1 passed'));
        //simulateKeyPressOnDocument("A");
        //simulateKeyPress(commentBoxes.snapshotItem(i),"C");
        var childElements = getElementByXpath(commentBoxes.snapshotItem(i),"./div/div");
        console.log("--search child elements");
        for ( var j=0 ; j < commentBoxes.snapshotLength; j++ ){
            console.log("-- child: " + j);
            console.log(childElements.snapshotItem(j))
        }
        for ( var k=0 ; k < commentBoxes.snapshotLength; k++ ){
            console.log("-- child: " + k);
            console.log(childElements.snapshotItem(k))
            simulateKeyPress(childElements.snapshotItem(k),"D");
        }
    }
    */
}

function simulateKeyPress(input, key) {
    if(input != null && key != null){
        console.log("---- sending key event now: " + key);
        input.addEventListener('keydown', () => { console.log('test')})
        input.dispatchEvent(new KeyboardEvent('keydown', { key }));
        input.dispatchEvent(new KeyboardEvent('keydown', {
            key: "b",
            keyCode: 66,
            code: "KeyE",
            which: 66,
            shiftKey: false,
            ctrlKey: false,
            metaKey: false
        }));
        input.dispatchEvent(new KeyboardEvent('keydown', {
            'key': "b",
            'keyCode': 66,
            'code': "KeyE",
            'which': 66,
            'shiftKey': false,
            'ctrlKey': false,
            'metaKey': false
        }));
        input.dispatchEvent(new KeyboardEvent('keydown',{'key':'a'}));
        input.dispatchEvent(new KeyboardEvent('keydown',{key:'a'}));
        window.dispatchEvent(new KeyboardEvent('keydown', { key }));
        window.dispatchEvent(new KeyboardEvent('keydown', {
            key: "b",
            keyCode: 66,
            code: "KeyE",
            which: 66,
            shiftKey: false,
            ctrlKey: false,
            metaKey: false
        }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key }));
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: "b",
            keyCode: 66,
            code: "KeyE",
            which: 66,
            shiftKey: false,
            ctrlKey: false,
            metaKey: false
        }));
    }else{
        console.log("No key event since either the key or the input is null");
    }
}

function simulateKeyPressOnDocument(key) {
  const event = new KeyboardEvent('keydown', { key });
  document.dispatchEvent(event);
}

async function asyncDelay() {
  console.log('start timer');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('after 1 second');
}

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

function collectLinks(){
    var friendsList = getElementByXpath(null, "//div[./*/*/*/div/h2/span/a[contains(text(),'Friends')]]/div/div/div/div/a[span]");
    for ( var i=0 ; i < friendsList.snapshotLength; i++ ){
        var fUrl = friendsList.snapshotItem(i).href;
        console.log(fUrl);
        friendUrls.push(fUrl);
    }
}

function scrollToBottom() {
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
                console.log("=========== End of the page ============");
                collectLinks();
                //console.log("=========== Video links ============\n" + links.map(link => `${link}`).join("\n"));
            }
        }, 3000);
    }, 2000);
}

function scrollToElement(el) {
    var offset = getOffset(el);
    window.scrollTo(offset.left, offset.top);
    console.log('scroll to: ' + offset.left + ":" + offset.top);
}

function getOffset(el) {
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY - 150 //to avoid the element to be hidden behide the top banner
  };
}