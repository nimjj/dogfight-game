import type { ClientMsg, ServerMsg } from '../../shared/protocol.ts';

/** Thin WebSocket wrapper. In dev Vite proxies /ws to the game server; in production the server serves both. */
export class NetClient {
  private ws: WebSocket | null = null;
  onMessage: (m: ServerMsg) => void = () => {};
  onClose: () => void = () => {};
  closed = false;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('Could not reach the game server. Is it running (npm run dev)?'));
      ws.onmessage = (ev) => {
        try {
          this.onMessage(JSON.parse(String(ev.data)) as ServerMsg);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        this.closed = true;
        this.onClose();
      };
    });
  }

  send(m: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  close(): void {
    this.onClose = () => {};
    this.ws?.close();
    this.closed = true;
  }
}
