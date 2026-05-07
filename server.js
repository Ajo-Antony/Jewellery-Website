/**
 * THOPPIL JEWELLERY — Supabase Edition
 * Zero npm dependencies — uses Node.js 18+ built-in fetch
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ── Load .env (handles Windows CRLF) ──────────────────────────
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8')
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) process.env[key] = val;
    });
  console.log('📄 .env loaded');
})();

// ── Config (read after .env loads) ────────────────────────────
const PORT   = process.env.PORT   || 3000;
const BUCKET = 'jewellery-images';

const MIME = {
  '.html':'text/html', '.css':'text/css', '.js':'application/javascript',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2'
};

// ── Supabase helpers ───────────────────────────────────────────
function sbUrl() { return process.env.SUPABASE_URL || ''; }
function sbKey() { return process.env.SUPABASE_SERVICE_KEY || ''; }

function checkSB() {
  if (!sbUrl() || !sbKey())
    throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file.');
}

async function sb(method, sbPath, body, extra = {}) {
  checkSB();
  const res = await fetch(`${sbUrl()}${sbPath}`, {
    method,
    headers: {
      'apikey': sbKey(),
      'Authorization': `Bearer ${sbKey()}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...extra
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : null;
}

async function sbUpload(filename, buffer, mimetype) {
  checkSB();
  const res = await fetch(`${sbUrl()}/storage/v1/object/${BUCKET}/${filename}`, {
    method: 'POST',
    headers: {
      'apikey': sbKey(),
      'Authorization': `Bearer ${sbKey()}`,
      'Content-Type': mimetype,
      'x-upsert': 'true'
    },
    body: buffer
  });
  if (!res.ok) throw new Error(await res.text());
  return `${sbUrl()}/storage/v1/object/public/${BUCKET}/${filename}`;
}

async function sbDeleteFile(fileUrl) {
  if (!fileUrl || !sbUrl() || !sbKey()) return;
  const filename = fileUrl.split(`/${BUCKET}/`)[1];
  if (!filename) return;
  await fetch(`${sbUrl()}/storage/v1/object/${BUCKET}/${filename}`, {
    method: 'DELETE',
    headers: { 'apikey': sbKey(), 'Authorization': `Bearer ${sbKey()}` }
  }).catch(() => {});
}

// ── Password & JWT ─────────────────────────────────────────────
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.scryptSync(pw, salt, 64).toString('hex') === hash;
}
function b64u(buf) { return Buffer.from(buf).toString('base64url'); }
function jwtKey()  { return process.env.JWT_SECRET || 'thoppil-jewellery-secret-2024'; }
function signJWT(payload) {
  const h = b64u(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const b = b64u(JSON.stringify({...payload, exp: Math.floor(Date.now()/1000)+86400}));
  const s = b64u(crypto.createHmac('sha256', jwtKey()).update(`${h}.${b}`).digest());
  return `${h}.${b}.${s}`;
}
function verifyJWT(token) {
  try {
    const [h,b,s] = token.split('.');
    const exp = b64u(crypto.createHmac('sha256', jwtKey()).update(`${h}.${b}`).digest());
    if (s !== exp) return null;
    const p = JSON.parse(Buffer.from(b,'base64url').toString());
    return p.exp < Math.floor(Date.now()/1000) ? null : p;
  } catch { return null; }
}

// ── Request helpers ────────────────────────────────────────────
function requireAuth(req) {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJWT(auth.slice(7));
}
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
  res.end(body);
}
function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  res.writeHead(200, {'Content-Type':mime,'Content-Length':stat.size,'Cache-Control':'no-cache'});
  fs.createReadStream(filePath).pipe(res);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function parseMultipart(buffer, boundary) {
  const fields = {}, sep = Buffer.from(`--${boundary}`);
  let pos = 0, file = null;
  while (pos < buffer.length) {
    const si = buffer.indexOf(sep, pos);
    if (si === -1) break;
    pos = si + sep.length;
    if (buffer[pos]===45 && buffer[pos+1]===45) break;
    if (buffer[pos]===13) pos += 2;
    const he = buffer.indexOf(Buffer.from('\r\n\r\n'), pos);
    if (he === -1) break;
    const hs = buffer.slice(pos, he).toString();
    pos = he + 4;
    const ns = buffer.indexOf(sep, pos);
    const de = ns === -1 ? buffer.length : ns - 2;
    const data = buffer.slice(pos, de);
    const dm = hs.match(/name="([^"]+)"/);
    const fm = hs.match(/filename="([^"]*)"/);
    const cm = hs.match(/Content-Type:\s*(\S+)/i);
    if (dm) {
      if (fm && fm[1]) file = { filename:fm[1], mimetype:cm?cm[1]:'application/octet-stream', buffer:data };
      else fields[dm[1]] = data.toString();
    }
    pos = ns !== -1 ? ns : buffer.length;
  }
  return { fields, file };
}
function parsePath(reqUrl) {
  try { return new URL(reqUrl, 'http://localhost').pathname.replace(/\/$/, '') || '/'; }
  catch { return reqUrl.split('?')[0].replace(/\/$/, '') || '/'; }
}

// ── HTTP Server ────────────────────────────────────────────────
http.createServer(async (req, res) => {
  const pname  = parsePath(req.url);
  const method = req.method.toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type'
    });
    return res.end();
  }

  try {

    // PUBLIC: get categories
    if (pname === '/api/categories' && method === 'GET') {
      const data = await sb('GET', '/rest/v1/categories?select=*&order=created_at.asc');
      return sendJSON(res, 200, data || []);
    }

    // PUBLIC: submit enquiry
    if (pname === '/api/enquiry' && method === 'POST') {
      const {name, phone, email, message} = JSON.parse((await readBody(req)).toString());
      if (!name || !phone) return sendJSON(res, 400, {error:'Name and phone required'});
      const data = await sb('POST', '/rest/v1/enquiries', {
        name, phone, email:email||'', message:message||'', status:'new'
      });
      return sendJSON(res, 200, {success:true, enquiry:data?.[0]});
    }

    // ADMIN: login
    if (pname === '/api/admin/login' && method === 'POST') {
      const {username, password} = JSON.parse((await readBody(req)).toString());
      const adminUser = process.env.ADMIN_USERNAME || 'admin';
      const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
      const adminHash = process.env.ADMIN_PASSWORD_HASH || '';
      const valid = adminHash
        ? username === adminUser && verifyPassword(password, adminHash)
        : username === adminUser && password === adminPass;
      if (!valid) return sendJSON(res, 401, {error:'Invalid credentials'});
      return sendJSON(res, 200, {success:true, token:signJWT({username, role:'admin'})});
    }

    // ADMIN: verify token
    if (pname === '/api/admin/verify' && method === 'GET') {
      const admin = requireAuth(req);
      return admin ? sendJSON(res,200,{valid:true,admin}) : sendJSON(res,401,{error:'Unauthorized'});
    }

    // ADMIN: logout
    if (pname === '/api/admin/logout' && method === 'POST')
      return sendJSON(res, 200, {success:true});

    // ADMIN: list categories
    if (pname === '/api/admin/categories' && method === 'GET') {
      if (!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const data = await sb('GET', '/rest/v1/categories?select=*&order=created_at.asc');
      return sendJSON(res, 200, data || []);
    }

    // ADMIN: add category
    if (pname === '/api/admin/categories' && method === 'POST') {
      if (!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const ct = req.headers['content-type']||'';
      const body = await readBody(req);
      let name, description, featured, fileData=null;
      if (ct.includes('multipart/form-data')) {
        const bnd = ct.split('boundary=')[1];
        const {fields,file} = parseMultipart(body,bnd);
        ({name,description,featured} = fields); fileData = file;
      } else {
        ({name,description,featured} = JSON.parse(body.toString()));
      }
      if (!name) return sendJSON(res,400,{error:'Name required'});
      let image_url = null;
      if (fileData && fileData.buffer.length > 0) {
        const ext = path.extname(fileData.filename)||'.jpg';
        image_url = await sbUpload(`cat-${Date.now()}${ext}`, fileData.buffer, fileData.mimetype);
      }
      const data = await sb('POST', '/rest/v1/categories', {
        name, description:description||'', image_url, featured:featured==='true'
      });
      return sendJSON(res,200,{success:true,category:data?.[0]});
    }

    // ADMIN: update category
    const catM = pname.match(/^\/api\/admin\/categories\/(\d+)$/);
    if (catM && method === 'PUT') {
      if (!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const id = catM[1];
      const ct = req.headers['content-type']||'';
      const body = await readBody(req);
      let name, description, featured, fileData=null;
      if (ct.includes('multipart/form-data')) {
        const bnd = ct.split('boundary=')[1];
        const {fields,file} = parseMultipart(body,bnd);
        ({name,description,featured} = fields); fileData = file;
      } else {
        ({name,description,featured} = JSON.parse(body.toString()));
      }
      const existing = await sb('GET', `/rest/v1/categories?id=eq.${id}&select=*`);
      if (!existing?.length) return sendJSON(res,404,{error:'Not found'});
      let image_url = existing[0].image_url;
      if (fileData && fileData.buffer.length > 0) {
        await sbDeleteFile(image_url);
        const ext = path.extname(fileData.filename)||'.jpg';
        image_url = await sbUpload(`cat-${Date.now()}${ext}`, fileData.buffer, fileData.mimetype);
      }
      const updates = { image_url, updated_at: new Date().toISOString() };
      if (name) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (featured !== undefined) updates.featured = featured==='true';
      const data = await sb('PATCH', `/rest/v1/categories?id=eq.${id}`, updates);
      return sendJSON(res,200,{success:true,category:data?.[0]});
    }

    // ADMIN: delete category
    if (catM && method === 'DELETE') {
      if (!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const id = catM[1];
      const existing = await sb('GET', `/rest/v1/categories?id=eq.${id}&select=*`);
      if (existing?.length) await sbDeleteFile(existing[0].image_url);
      await sb('DELETE', `/rest/v1/categories?id=eq.${id}`);
      return sendJSON(res,200,{success:true});
    }

    // ADMIN: list enquiries
    if (pname === '/api/admin/enquiries' && method === 'GET') {
      if (!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const data = await sb('GET', '/rest/v1/enquiries?select=*&order=created_at.desc');
      return sendJSON(res, 200, data || []);
    }

    // ADMIN: update enquiry status
    const enqM = pname.match(/^\/api\/admin\/enquiries\/(\d+)$/);
    if (enqM && method === 'PUT') {
      if (!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const {status} = JSON.parse((await readBody(req)).toString());
      await sb('PATCH', `/rest/v1/enquiries?id=eq.${enqM[1]}`, {status});
      return sendJSON(res,200,{success:true});
    }

    // ADMIN: delete enquiry
    if (enqM && method === 'DELETE') {
      if (!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      await sb('DELETE', `/rest/v1/enquiries?id=eq.${enqM[1]}`);
      return sendJSON(res,200,{success:true});
    }

    // ADMIN: change password
    if (pname === '/api/admin/password' && method === 'PUT') {
      if (!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const {currentPassword, newPassword} = JSON.parse((await readBody(req)).toString());
      const storedHash = process.env.ADMIN_PASSWORD_HASH;
      const adminPass  = process.env.ADMIN_PASSWORD || 'admin123';
      const ok = storedHash ? verifyPassword(currentPassword, storedHash) : currentPassword === adminPass;
      if (!ok) return sendJSON(res,400,{error:'Current password incorrect'});
      const newHash = hashPassword(newPassword);
      console.log('\n🔑 ADMIN_PASSWORD_HASH=' + newHash + '\n');
      return sendJSON(res,200,{success:true,message:'Add the hash printed in console to your env as ADMIN_PASSWORD_HASH'});
    }

    // ── Static files ───────────────────────────────────────────
    if (pname === '/admin' || pname.startsWith('/admin/')) {
      const ap = pname === '/admin' ? '/admin/index.html' : pname;
      const fp = path.join(__dirname, ap);
      return serveFile(res, fs.existsSync(fp) && path.extname(fp) ? fp : path.join(__dirname,'admin','index.html'));
    }
    if (pname === '/' || pname === '/index.html')
      return serveFile(res, path.join(__dirname,'public','index.html'));
    const sp = path.join(__dirname,'public',pname);
    if (fs.existsSync(sp) && !fs.statSync(sp).isDirectory())
      return serveFile(res, sp);

    res.writeHead(404); res.end('Not found');

  } catch(err) {
    console.error('Error:', err.message);
    sendJSON(res, 500, {error: err.message});
  }

}).listen(PORT, () => {
  console.log(`\n✨ Thoppil Jewellery (Supabase Edition)`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`🔐 Admin: http://localhost:${PORT}/admin`);
  if (!sbUrl()) console.warn('⚠️  SUPABASE_URL not set! Add it to your .env file.\n');
  else console.log(`✅ Supabase: ${sbUrl()}\n`);
});