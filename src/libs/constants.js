export const TYPE_CONTENT_CONNECTION = "content-connection";
export const TYPE_EXTENSION_READY = "extension-ready";
export const TYPE_CONNECTION_REQUEST = "connection-request";
export const TYPE_CONNECTION_RESPONSE = "connection-response";
export const TYPE_CONNECTION_ERROR = "connection-error";

export const METHOD_NOTIFY_LISTENER = "notifyListener";
export const METHOD_ADD_LISTENER = "addListener";
export const METHOD_REMOVE_LISTENER = "removeListener";
export const METHOD_INIT = "init";
export const METHOD_DONE = "done";

// This method is called by the content script
// to notify that the connection with the background
// was lost. The client API must the METHOD_INIT method again
// to re-establish all the listeners.
export const METHOD_RESET_CONNECTION = "reset";
