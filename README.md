# chrome.debugger API 

This Chrome extension allows to pilot resources from a web page. 


## How to use?

1. Import this extension in Chrome
2. Open the index.html page over HTTP `http://localhost:8080/index.html`

The page should create a new browser tab, navigate to external resources and create screenshots.
The screenshots are show on the page.

## API

Information about the `chrome.debugger` api - see https://developer.chrome.com/docs/extensions/reference/debugger/.

This API is inspired by https://github.com/TracerBench/chrome-debugging-client/.

Types and Methods:
- `type Target = { tabId : number }`
- `open(url?: string, version : string = '1.3') : Promise<Target>` - creates a new tab and open debug session 
- `send(target: Target, method: string, params: Record<string, any>) : Promise<Record<string, any>>` - launches the command on the specified target
- `until(target: Target, event: string): Promise<any>` - notification from the page
- `close(target: Target): Promise<void>` - closes the specified tab with the corresponding debug session and focus back the original page

## How it works?

Extension creates a bridge with the page and exposes the `chrome.debugger` api to this page.
The page creates a new browser tab and pilot resources in this tab using the Dev Tools Protocol (https://chromedevtools.github.io/devtools-protocol/).

