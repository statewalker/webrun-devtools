export function runCommand(target, {
  world = 'ISOLATED', ...options
} = {}) {
  const [{ result, documentId, frameId }] = await chrome.scripting.executeScript({
    target,
    injectImmediately: true,
    world,
    args: [options],
    func: async function runCommand({ command, args = [] }) {
      // * await for an element(s) defined by a selector
      // 
      // * get computed styles
      // * get bounding boxes
      // * scroll
      //   * get scroll position of an element
      //   * scroll to a specific position
      // * get info
      //   * get resolved URLs for images, links, frames, by selectors 
      //   * get the base64 encoded content of the images
      //   * transform HTML elements to JSON objects
      //     - [{ select: "article>div>h3", prop: "innerText", target : "product.title" }]
      //     - [{ select: "article>div>div", prop: "innerHTML", target : "product.description" }]
      //     - [{ select: "a", attr: "href", target: "product.url"}],
      //     - [{ select: "img", attr: "src", target: "product.image"}],
      //     - [{ select: "article", children : [
      //          { select: "div>h3", prop: "innerText", target : "title" },
      //        ] }],
      //   * get text from elements
      //   * get HTML from elements
      //   * get attributes from elements
      //   * get properties from elements
      //   * get data from elements
      // * create / update
      //   * create an element with the specified content and inject it into parent with the given selector
      //   * append/remove content to an element
      // * menu:
      //   * inject a command in the context menu
      // * panels
      //   * add a window with an iframe; 
      //     we can communicate with this window
      //   * dispatch message to the target (window, iframe, ...)
      // 
      args = Array.isArray(args) ? args : args !== undefined ? [args] : [];

      let path = [];
      if (typeof command === 'string') {
        path = command.split('.');
      } else {
        path = command;
      }
      let obj = 'window';
      const first = path[0];
      if (first === 'window') {
        obj = window;
        path.shift();
      } else if (first === 'document') {
        obj = document;
        path.shift();
      } else if (first === 'console') {
        obj = console;
        path.shift();
      }
      for (const key of path) {
        if (typeof obj[key] === 'function') {
          obj = obj[key].bind(obj);
        } else {
          obj = obj[key];
        }
      }
      let result = obj;
      if (typeof obj === 'function') {
        result = await obj(...args);
      }

      if (result && typeof result === 'object') {
        result = Array.isArray(result) ? [...result] : { ...result };
      }
      // To be sure that we have a plain object.
      return JSON.parse(JSON.stringify(result));
    }
  });
  console.log('!!!!',
    { options, world },
    { result, documentId, frameId }
  );
  return { result, documentId, frameId };
}
