export async function injectScript(
  target,
  { func, args = [], type = 'module' } = {}
) {
  const [{ result, documentId, frameId }] = await chrome.scripting.executeScript({
    target,
    injectImmediately: true,
    world: 'MAIN',
    args: [
      {
        func,
        args,
        type
      }
    ],
    // A standalone script without any dependencies.
    // So we can not use imported / global statements here.
    func: async function injectedFunction({ func, args }) {
      try {
        const code = `return (${func})`;
        const f = new Function([], code)();
        const result = await f(...args);
        return {
          status: 'ok',
          result
        };
      } catch (error) {
        const stack = error.stack.split('\n');
        let positions;
        for (const line of stack) {
          line.replace(
            /\(eval .* \(:(\d+):(\d+)\)[^\r\n]*:(\d+):(\d+)\)/gim,
            (_, _startLine, _startPos, _line, _pos) => {
              positions = [_startLine, _startPos, _line, _pos].map(
                (d) => +d
              );
            }
          );
          if (positions) break;
        }
        positions = positions || [0, 0, 0, 0];
        const line = positions[2] - positions[0];
        const column = positions[3];
        return {
          status: 'error',
          error: {
            message: error.message,
            stack,
            line,
            column
          }
        };
      }
    }
  });
  return { ...result, documentId, frameId };
}
