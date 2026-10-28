// Servidor sin dependencias: HTTP + Server-Sent Events. Ejecuta: node server.js
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000, ROUND_MS = 90000;
const WORDS = ["gato","casa","árbol","pizza","bicicleta","sol","luna","pelota","avión","guitarra","helado","reloj","paraguas","tortuga","cohete","montaña","playa","robot","corazón","mariposa","castillo","dinosaurio","tijeras","plátano","volcán","fantasma","jirafa","teléfono","cámara","zapato","pingüino","arcoíris","escalera","tren","ballena","dragón","hamburguesa","lentes","payaso","sombrero"];
const rooms = new Map();
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const getRoom = c => { if (!rooms.has(c)) rooms.set(c, { players: new Map(), drawer: null, word: '', phase: 'idle', endsAt: 0, strokes: [], timer: null }); return rooms.get(c); };
const sse = (res, ev, d) => res.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`);
const all = (r, ev, d, except) => r.players.forEach(p => { if (p.id !== except) sse(p.res, ev, d); });
const pub = r => ({ players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, score: p.score })), drawer: r.drawer, phase: r.phase,
  left: Math.max(0, r.endsAt - Date.now()), hint: r.phase === 'draw' ? r.word.replace(/[^ ]/g, '_').split('').join(' ') : '' });
function endRound(r, winner) {
  clearTimeout(r.timer); r.phase = 'end';
  all(r, 'end', { word: r.word, winner: winner ? winner.name : null });
  all(r, 'state', pub(r));
}
function startRound(r, id) {
  if (r.phase === 'draw') return;
  r.word = WORDS[Math.floor(Math.random() * WORDS.length)]; r.drawer = id; r.phase = 'draw';
  r.endsAt = Date.now() + ROUND_MS; r.strokes = [];
  r.timer = setTimeout(() => endRound(r, null), ROUND_MS);
  all(r, 'clear', {}); all(r, 'state', pub(r));
  sse(r.players.get(id).res, 'word', { w: r.word }); // solo el artista recibe la palabra
}
function handle(r, p, b) {
  const draw = r.phase === 'draw';
  if (b.type === 'start') startRound(r, p.id);
  else if (b.type === 'clear' && draw && p.id === r.drawer) { r.strokes = []; all(r, 'clear', {}, p.id); }
  else if (b.type === 'stroke' && draw && p.id === r.drawer && Array.isArray(b.p) && b.p.length <= 600) {
    const s = { c: String(b.c).slice(0, 9), w: Math.min(30, +b.w || 6), p: b.p.map(Number) };
    if (r.strokes.length < 3000) r.strokes.push(s); all(r, 'stroke', s, p.id);
  } else if (b.type === 'guess') {
    const t = String(b.text || '').slice(0, 40).trim(); if (!t) return;
    if (draw && p.id !== r.drawer && norm(t) === norm(r.word)) {
      p.score += 10 + Math.floor((r.endsAt - Date.now()) / 9000);
      const d = r.players.get(r.drawer); if (d) d.score += 5;
      endRound(r, p);
    } else if (!(draw && p.id === r.drawer && norm(t).includes(norm(r.word)))) all(r, 'chat', { n: p.name, t });
  }
}
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && u.pathname === '/events') {
    const code = (u.searchParams.get('room') || 'sala').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'sala';
    const id = String(u.searchParams.get('id') || '').slice(0, 16), r = getRoom(code);
    if (!id || r.players.size >= 12) { res.writeHead(403); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const p = { id, name: String(u.searchParams.get('name') || 'Jugador').slice(0, 16), score: 0, res };
    r.players.set(id, p);
    sse(res, 'init', { ...pub(r), strokes: r.strokes }); all(r, 'state', pub(r), id);
    const hb = setInterval(() => res.write(': hb\n\n'), 20000);
    req.on('close', () => {
      clearInterval(hb); r.players.delete(id);
      if (!r.players.size) { clearTimeout(r.timer); rooms.delete(code); return; }
      if (r.phase === 'draw' && r.drawer === id) endRound(r, null); else all(r, 'state', pub(r));
    });
  } else if (req.method === 'POST' && u.pathname === '/api') {
    let raw = ''; req.on('data', c => { raw += c; if (raw.length > 16000) req.destroy(); });
    req.on('end', () => {
      try { const b = JSON.parse(raw), r = rooms.get(String(b.room)), p = r && r.players.get(String(b.id)); if (p) handle(r, p, b); } catch (e) {}
      res.writeHead(204); res.end();
    });
  } else if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); fs.createReadStream(path.join(__dirname, 'public', 'index.html')).pipe(res);
  } else { res.writeHead(404); res.end('No encontrado'); }
}).listen(PORT, () => console.log('Juego en http://localhost:' + PORT));
