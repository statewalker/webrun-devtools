export async function connectToWs(url, signal) {
  const socket = new WebSocket(url);
  await new Promise(
    (resolve) =>
      (socket.onopen = function onOpen() {
        socket.onopen = null;
        resolve();
      })
  );
  const channel = new MessageChannel();
  const socketPort = channel.port1;
  const clientPort = channel.port2;
  socket.onmessage = ({ data }) => socketPort.postMessage(JSON.parse(data));
  socketPort.onmessage = ({ data }) => socket.send(JSON.stringify(data));
  const closeSocketPort = socketPort.close.bind(socketPort);
  const closeSocket = socket.close.bind(socket);
  const clientPortClose = clientPort.close.bind(channel.port2);

  const closeAll = () => {
    clientPortClose();
    closeSocketPort();
    closeSocket();
  };
  socketPort.close = closeAll;
  channel.port2.close = closeAll;
  if (signal) {
    if (signal.aborted) {
      closeAll();
    }
    signal.addEventListener("abort", () => closeAll());
  }
  return channel.port2;
}
