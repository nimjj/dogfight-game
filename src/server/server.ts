import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { PILOTS } from '../shared/config/pilots.ts';
import type { PilotId } from '../shared/config/pilots.ts';
import { SPECIALS } from '../shared/config/specials.ts';
import type { SpecialId } from '../shared/config/specials.ts';
import type { ClientMsg, ServerMsg } from '../shared/protocol.ts';
import type { InputState } from '../shared/types.ts';
import { Room } from './Room.ts';
import type { Member } from './Room.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_ROOMS = 200;

export interface GameServer {
  port: number;
  rooms: Map<string, Room>;
  close(): Promise<void>;
}

function num(v: unknown, lo: number, hi: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0;
}

/** Never trust the wire: coerce whatever arrives into a well-formed input. */
export function sanitizeInput(raw: unknown): InputState {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    turn: num(r['turn'], -1, 1),
    thrust: r['thrust'] === true,
    gun: r['gun'] === true,
    missile: r['missile'] === true,
    special: r['special'] === true,
    flare: r['flare'] === true,
  };
}

function isPilot(v: unknown): v is PilotId {
  return typeof v === 'string' && Object.hasOwn(PILOTS, v);
}
function isSpecial(v: unknown): v is SpecialId {
  return typeof v === 'string' && Object.hasOwn(SPECIALS, v);
}

export function createGameServer(opts: { port: number; host?: string; staticDir?: string }): Promise<GameServer> {
  const staticDir = resolve(opts.staticDir ?? fileURLToPath(new URL('../../dist', import.meta.url)));
  const rooms = new Map<string, Room>();

  const http: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    if (!existsSync(staticDir)) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Dogfight Co-op game server is running.\nBuild the client with "npm run build", or use "npm run dev" for development.\n');
      return;
    }
    let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (rel === '') rel = 'index.html';
    let file = join(staticDir, rel);
    if (!file.startsWith(staticDir)) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(staticDir, 'index.html');
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });

  const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 4096 });

  function newCode(): string {
    for (let tries = 0; tries < 50; tries++) {
      let c = '';
      for (let i = 0; i < 4; i++) c += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
      if (!rooms.has(c)) return c;
    }
    return '';
  }

  wss.on('connection', (ws: WebSocket) => {
    let room: Room | null = null;
    let member: Member | null = null;
    const reply = (m: ServerMsg) => ws.readyState === 1 && ws.send(JSON.stringify(m));
    const fail = (msg: string) => reply({ t: 'error', msg });

    ws.on('message', (data) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(data)) as ClientMsg;
      } catch {
        return;
      }
      if (typeof msg !== 'object' || msg === null) return;

      switch (msg.t) {
        case 'create': {
          if (room) return;
          if (!isPilot(msg.pilot) || !isSpecial(msg.special)) return fail('Bad pilot selection.');
          if (rooms.size >= MAX_ROOMS) return fail('The server is full. Try again later.');
          const code = newCode();
          if (!code) return fail('Could not create a room.');
          const r = new Room(code, (dead) => rooms.delete(dead.code));
          rooms.set(code, r);
          const token = randomBytes(12).toString('hex');
          const m = r.add(ws, msg.pilot, msg.special, token);
          if (!m) return fail('Could not create a room.');
          room = r;
          member = m;
          reply({ t: 'joined', code, slot: m.slot, token, host: true });
          break;
        }
        case 'join': {
          if (room) return;
          if (!isPilot(msg.pilot) || !isSpecial(msg.special)) return fail('Bad pilot selection.');
          const r = rooms.get(String(msg.code ?? '').toUpperCase());
          if (!r) return fail('No room with that code.');
          if (r.phase !== 'lobby') return fail('That match has already started.');
          const token = randomBytes(12).toString('hex');
          const m = r.add(ws, msg.pilot, msg.special, token);
          if (!m) return fail('That room is full.');
          room = r;
          member = m;
          reply({ t: 'joined', code: r.code, slot: m.slot, token, host: false });
          break;
        }
        case 'rejoin': {
          if (room) return;
          const r = rooms.get(String(msg.code ?? '').toUpperCase());
          const m = r?.members[Number(msg.slot)];
          if (!r || !m || !m.token || m.token !== msg.token) return fail('That match is no longer available.');
          const err = r.rejoin(m, ws);
          if (err) return fail(err);
          room = r;
          member = m;
          break;
        }
        case 'start': {
          if (!room || !member) return;
          const err = room.start(member);
          if (err) fail(err);
          break;
        }
        case 'input': {
          if (!room || !member) return;
          const seq = Math.floor(num(msg.seq, 0, 2 ** 31));
          room.input(member, seq, sanitizeInput(msg.i));
          break;
        }
        case 'ping':
          reply({ t: 'pong', c: num(msg.c, 0, 2 ** 31) });
          break;
        default:
          break;
      }
    });

    ws.on('close', () => {
      if (room && member) room.leave(member, ws);
    });
    ws.on('error', () => ws.terminate());
  });

  return new Promise((resolveListen, rejectListen) => {
    http.once('error', rejectListen);
    http.listen(opts.port, opts.host ?? '0.0.0.0', () => {
      const addr = http.address();
      const port = typeof addr === 'object' && addr ? addr.port : opts.port;
      resolveListen({
        port,
        rooms,
        close: () =>
          new Promise<void>((done) => {
            for (const r of [...rooms.values()]) r.destroy();
            for (const c of wss.clients) c.terminate();
            wss.close();
            http.close(() => done());
          }),
      });
    });
  });
}
