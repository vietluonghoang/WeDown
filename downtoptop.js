let links = [];

function collectLinks() {
  const allLinks = document.getElementsByTagName("a");
  for (let i = 0; i < allLinks.length; i++) {
    const link = allLinks[i].href;
    if (link.includes("/video/")) {
      links.push(link);
    }
  }
}

function scrollToBottom() {
  window.scrollTo(0, document.body.scrollHeight);
  setTimeout(() => {
    const previousHeight = document.body.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
    setTimeout(() => {
      if (document.body.scrollHeight > previousHeight) {
        scrollToBottom();
      } else {
        collectLinks();
        const linksHtml = links.map(link => `<li><a href="${link}">${link}</a></li>`).join("");
        const html = `<html><head><title>Video Links</title></head><body><ul>${linksHtml}</ul></body></html>`;
        const newTab = window.open();
        newTab.document.write(html);
      }
    }, 3000);
  }, 2000);
}

scrollToBottom();
