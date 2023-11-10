# chrome.debugger API 

This Chrome extension allows to pilot resources from a web page. 

## How to use?

1. Import this extension in Chrome
2. Open the index.html page over HTTP `http://localhost:8080/index.html`

The page should create a new browser tab, navigate to external resources and create screenshots.
The screenshots are show on the page.

## How it works?

Extension creates a bridge with the page and exposes the `chrome.debugger` api to this page.
The page creates a new browser tab and pilot resources in this tab using the Dev Tools Protocol (https://chromedevtools.github.io/devtools-protocol/).

