export async function establishPageToExtensionConnection() {
  return new Promise((resolve) => {
    window.addEventListener('message', function messageListener(ev) {
      const { data, ports } = ev;
      if (data?.type === 'handshake' && ports?.length > 0) {
        window.removeEventListener('message', messageListener);
        const [port] = ports;
        resolve(port);
      }
    });
  });
}
