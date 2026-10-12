import { networkInterfaces } from 'node:os';
import { createGameServer } from './server.ts';

const port = Number(process.env['PORT'] ?? 2567);

createGameServer({ port }).then(
  (s) => {
    console.log(`Dogfight Co-op server listening on port ${s.port}`);
    const lan: string[] = [];
    for (const list of Object.values(networkInterfaces())) {
      for (const n of list ?? []) if (n.family === 'IPv4' && !n.internal) lan.push(n.address);
    }
    console.log(`  Local:   http://localhost:${s.port}  (production build) or http://localhost:5173 (npm run dev)`);
    for (const ip of lan) console.log(`  Network: http://${ip}:${s.port}  /  http://${ip}:5173`);
  },
  (err: Error) => {
    console.error(`Could not start the server: ${err.message}`);
    process.exit(1);
  },
);
