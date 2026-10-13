// Tiny RFC 6455 subset for browser JSON messages. No third-party modules required.
import { createHash } from 'node:crypto';
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export function attachWebSocketServer(server, onClient, validateOrigin = () => true) {
  server.on('upgrade', (request, socket, head) => {
    const raw = request.headers['sec-websocket-key'];
    if (request.url?.split('?')[0] !== '/ws' || !validateOrigin(request.headers.origin) || request.headers.upgrade?.toLowerCase() !== 'websocket' || request.headers['sec-websocket-version'] !== '13' || typeof raw !== 'string' || !/^[a-zA-Z0-9+/]{22}==$/.test(raw)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    const accept = createHash('sha1').update(raw + GUID).digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    let closed = false, buffer = Buffer.alloc(0), lastPong = Date.now();
    const client = {
      onmessage: () => {}, onclose: () => {},
      send(value) { if (!closed && !socket.destroyed && socket.writableLength < 131072) sendFrame(1, Buffer.from(JSON.stringify(value))); },
      close() { if (closed) return; sendFrame(8, Buffer.alloc(0)); socket.end(); },
    };
    function sendFrame(op, data) {
      if (closed || socket.destroyed) return;
      const h = data.length <= 125 ? Buffer.from([0x80 | op, data.length]) : data.length <= 65535 ? Buffer.from([0x80 | op, 126, data.length >> 8, data.length & 255]) : Buffer.from([0x80 | op, 127, 0, 0, 0, 0, (data.length >>> 24) & 255, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255]);
      socket.write(Buffer.concat([h, data]));
    }
    function teardown() { if (closed) return; closed = true; clearInterval(keepalive); client.onclose(); }
    const keepalive = setInterval(() => { if (Date.now() - lastPong > 75000) return socket.destroy(); sendFrame(9, Buffer.from('rift')); }, 25000);
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 98304) return socket.destroy();
      while (buffer.length >= 2) {
        const b0 = buffer[0], b1 = buffer[1], opcode = b0 & 15, fin = Boolean(b0 & 0x80), masked = Boolean(b1 & 0x80); let len = b1 & 127, headSize = 2;
        if (len === 126) { if (buffer.length < 4) return; len = buffer.readUInt16BE(2); headSize = 4; }
        if (len === 127) { if (buffer.length < 10) return; const big = buffer.readBigUInt64BE(2); if (big > 65536n) return socket.destroy(); len = Number(big); headSize = 10; }
        if (!masked || len > 65536 || !fin) return socket.destroy();
        if (buffer.length < headSize + 4 + len) return;
        const mask = buffer.subarray(headSize, headSize + 4), data = Buffer.from(buffer.subarray(headSize + 4, headSize + 4 + len)); buffer = buffer.subarray(headSize + 4 + len);
        for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
        if (opcode === 8) { socket.end(); return; }
        if (opcode === 9) { sendFrame(10, data); continue; }
        if (opcode === 10) { lastPong = Date.now(); continue; }
        if (opcode !== 1) return socket.destroy();
        if (data.length > 4000) return socket.destroy();
        try { client.onmessage(JSON.parse(data.toString('utf8'))); } catch { /* malformed input ignored */ }
      }
    });
    socket.on('error', () => {}); socket.on('close', teardown); socket.on('end', teardown);
    if (head?.length) socket.emit('data', head);
    onClient(client);
  });
}