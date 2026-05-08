/**
 * THOPPIL JEWELLERY — Full Catalogue Edition
 * Node.js built-ins only · Supabase PostgreSQL + Storage
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
    .replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n')
    .forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const eq = t.indexOf('=');
      if (eq === -1) return;
      const k = t.slice(0,eq).trim();
      const v = t.slice(eq+1).trim().replace(/^["']|["']$/g,'');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  console.log('📄 .env loaded');
})();

const PORT   = process.env.PORT || 3000;
const BUCKET = 'jewellery-images';

const MIME = {
  '.html':'text/html','.css':'text/css','.js':'application/javascript',
  '.json':'application/json','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif',
  '.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'
};

// ── Supabase ───────────────────────────────────────────────────
const sbUrl = () => process.env.SUPABASE_URL || '';
const sbKey = () => process.env.SUPABASE_SERVICE_KEY || '';
function checkSB() {
  if (!sbUrl()||!sbKey()) throw new Error('Supabase not configured.');
}
async function sb(method, p, body, extra={}) {
  checkSB();
  const res = await fetch(`${sbUrl()}${p}`, {
    method,
    headers:{'apikey':sbKey(),'Authorization':`Bearer ${sbKey()}`,'Content-Type':'application/json','Prefer':'return=representation',...extra},
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : null;
}
async function sbUpload(filename, buffer, mimetype) {
  checkSB();
  const res = await fetch(`${sbUrl()}/storage/v1/object/${BUCKET}/${filename}`,{
    method:'POST',
    headers:{'apikey':sbKey(),'Authorization':`Bearer ${sbKey()}`,'Content-Type':mimetype,'x-upsert':'true'},
    body:buffer
  });
  if (!res.ok) throw new Error(await res.text());
  return `${sbUrl()}/storage/v1/object/public/${BUCKET}/${filename}`;
}
async function sbDeleteFile(fileUrl) {
  if (!fileUrl||!sbUrl()||!sbKey()) return;
  const fname = fileUrl.split(`/${BUCKET}/`)[1];
  if (!fname) return;
  await fetch(`${sbUrl()}/storage/v1/object/${BUCKET}/${fname}`,{
    method:'DELETE',
    headers:{'apikey':sbKey(),'Authorization':`Bearer ${sbKey()}`}
  }).catch(()=>{});
}

// ── Auth ───────────────────────────────────────────────────────
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt+':'+crypto.scryptSync(pw,salt,64).toString('hex');
}
function verifyPassword(pw,stored) {
  const [salt,hash]=stored.split(':');
  return crypto.scryptSync(pw,salt,64).toString('hex')===hash;
}
function b64u(buf){return Buffer.from(buf).toString('base64url');}
function jwtKey(){return process.env.JWT_SECRET||'thoppil-jewellery-secret-2024';}
function signJWT(payload){
  const h=b64u(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const b=b64u(JSON.stringify({...payload,exp:Math.floor(Date.now()/1000)+86400}));
  const s=b64u(crypto.createHmac('sha256',jwtKey()).update(`${h}.${b}`).digest());
  return `${h}.${b}.${s}`;
}
function verifyJWT(token){
  try{
    const [h,b,s]=token.split('.');
    const exp=b64u(crypto.createHmac('sha256',jwtKey()).update(`${h}.${b}`).digest());
    if(s!==exp)return null;
    const p=JSON.parse(Buffer.from(b,'base64url').toString());
    return p.exp<Math.floor(Date.now()/1000)?null:p;
  }catch{return null;}
}
function requireAuth(req){
  const auth=req.headers['authorization'];
  if(!auth?.startsWith('Bearer '))return null;
  return verifyJWT(auth.slice(7));
}

// ── HTTP helpers ───────────────────────────────────────────────
function sendJSON(res,status,obj){
  const body=JSON.stringify(obj);
  res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
  res.end(body);
}
function serveFile(res,filePath){
  if(!fs.existsSync(filePath)){res.writeHead(404);res.end('Not found');return;}
  const ext=path.extname(filePath).toLowerCase();
  const mime=MIME[ext]||'application/octet-stream';
  const stat=fs.statSync(filePath);
  res.writeHead(200,{'Content-Type':mime,'Content-Length':stat.size,'Cache-Control':'no-cache'});
  fs.createReadStream(filePath).pipe(res);
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    const c=[];
    req.on('data',d=>c.push(d));
    req.on('end',()=>resolve(Buffer.concat(c)));
    req.on('error',reject);
  });
}
function parseMultipart(buffer,boundary){
  const fields={},sep=Buffer.from(`--${boundary}`);
  let pos=0,files=[];
  while(pos<buffer.length){
    const si=buffer.indexOf(sep,pos);
    if(si===-1)break;
    pos=si+sep.length;
    if(buffer[pos]===45&&buffer[pos+1]===45)break;
    if(buffer[pos]===13)pos+=2;
    const he=buffer.indexOf(Buffer.from('\r\n\r\n'),pos);
    if(he===-1)break;
    const hs=buffer.slice(pos,he).toString();
    pos=he+4;
    const ns=buffer.indexOf(sep,pos);
    const de=ns===-1?buffer.length:ns-2;
    const data=buffer.slice(pos,de);
    const dm=hs.match(/name="([^"]+)"/);
    const fm=hs.match(/filename="([^"]*)"/);
    const cm=hs.match(/Content-Type:\s*(\S+)/i);
    if(dm){
      if(fm&&fm[1]) files.push({fieldname:dm[1],filename:fm[1],mimetype:cm?cm[1]:'application/octet-stream',buffer:data});
      else fields[dm[1]]=data.toString();
    }
    pos=ns!==-1?ns:buffer.length;
  }
  return{fields,files,file:files[0]||null};
}
function parsePath(reqUrl){
  try{return new URL(reqUrl,'http://localhost').pathname.replace(/\/$/,'')||'/';}
  catch{return reqUrl.split('?')[0].replace(/\/$/,'')||'/';}
}
function slugify(str){
  return str.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

// ── Server ─────────────────────────────────────────────────────
http.createServer(async(req,res)=>{
  const pname=parsePath(req.url);
  const method=req.method.toUpperCase();

  if(method==='OPTIONS'){
    res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type'});
    return res.end();
  }

  try{

    // ════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════

    // GET categories
    if(pname==='/api/categories'&&method==='GET'){
      const data=await sb('GET','/rest/v1/categories?select=*&order=created_at.asc');
      return sendJSON(res,200,data||[]);
    }

    // GET all products (optional ?featured=true&limit=N)
    if(pname==='/api/products'&&method==='GET'){
      const u=new URL(req.url,'http://localhost');
      let q='/rest/v1/products?select=*,categories(id,name,slug)&order=created_at.desc';
      if(u.searchParams.get('featured')==='true') q+='&featured=eq.true';
      const limit=parseInt(u.searchParams.get('limit')||'50');
      q+=`&limit=${limit}`;
      const data=await sb('GET',q);
      return sendJSON(res,200,data||[]);
    }

    // GET products by category slug
    const catSlugM=pname.match(/^\/api\/products\/category\/(.+)$/);
    if(catSlugM&&method==='GET'){
      const slug=catSlugM[1];
      const cats=await sb('GET',`/rest/v1/categories?slug=eq.${encodeURIComponent(slug)}&select=*`);
      if(!cats?.length) return sendJSON(res,404,{error:'Category not found'});
      const cat=cats[0];
      const products=await sb('GET',`/rest/v1/products?category_id=eq.${cat.id}&select=*,product_images(image_url,display_order)&order=created_at.desc`);
      return sendJSON(res,200,{category:cat,products:products||[]});
    }

    // GET single product by slug
    const prodSlugM=pname.match(/^\/api\/products\/slug\/(.+)$/);
    if(prodSlugM&&method==='GET'){
      const slug=prodSlugM[1];
      const data=await sb('GET',`/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&select=*,categories(id,name,slug),product_images(id,image_url,display_order)`);
      if(!data?.length) return sendJSON(res,404,{error:'Product not found'});
      const product=data[0];
      // Related products
      const related=product.category_id
        ? await sb('GET',`/rest/v1/products?category_id=eq.${product.category_id}&id=neq.${product.id}&select=*&limit=4`)
        : [];
      return sendJSON(res,200,{product,related:related||[]});
    }

    // GET single product by ID
    const prodIdM=pname.match(/^\/api\/products\/(\d+)$/);
    if(prodIdM&&method==='GET'){
      const data=await sb('GET',`/rest/v1/products?id=eq.${prodIdM[1]}&select=*,categories(id,name,slug),product_images(id,image_url,display_order)`);
      if(!data?.length) return sendJSON(res,404,{error:'Not found'});
      return sendJSON(res,200,data[0]);
    }

    // POST enquiry
    if(pname==='/api/enquiry'&&method==='POST'){
      const{name,phone,email,message}=JSON.parse((await readBody(req)).toString());
      if(!name||!phone) return sendJSON(res,400,{error:'Name and phone required'});
      const data=await sb('POST','/rest/v1/enquiries',{name,phone,email:email||'',message:message||'',status:'new'});
      return sendJSON(res,200,{success:true,enquiry:data?.[0]});
    }

    // ════════════════════════════════════════════════
    // ADMIN AUTH
    // ════════════════════════════════════════════════

    if(pname==='/api/admin/login'&&method==='POST'){
      const{username,password}=JSON.parse((await readBody(req)).toString());
      const adminUser=process.env.ADMIN_USERNAME||'admin';
      const adminPass=process.env.ADMIN_PASSWORD||'admin123';
      const adminHash=process.env.ADMIN_PASSWORD_HASH||'';
      const valid=adminHash
        ?username===adminUser&&verifyPassword(password,adminHash)
        :username===adminUser&&password===adminPass;
      if(!valid) return sendJSON(res,401,{error:'Invalid credentials'});
      return sendJSON(res,200,{success:true,token:signJWT({username,role:'admin'})});
    }
    if(pname==='/api/admin/verify'&&method==='GET'){
      const admin=requireAuth(req);
      return admin?sendJSON(res,200,{valid:true,admin}):sendJSON(res,401,{error:'Unauthorized'});
    }
    if(pname==='/api/admin/logout'&&method==='POST')
      return sendJSON(res,200,{success:true});

    // ════════════════════════════════════════════════
    // ADMIN: CATEGORIES
    // ════════════════════════════════════════════════

    if(pname==='/api/admin/categories'&&method==='GET'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const data=await sb('GET','/rest/v1/categories?select=*&order=created_at.asc');
      return sendJSON(res,200,data||[]);
    }
    if(pname==='/api/admin/categories'&&method==='POST'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const ct=req.headers['content-type']||'';
      const body=await readBody(req);
      let name,description,featured,fileData=null;
      if(ct.includes('multipart/form-data')){
        const bnd=ct.split('boundary=')[1];
        const{fields,file}=parseMultipart(body,bnd);
        ({name,description,featured}=fields);fileData=file;
      }else({name,description,featured}=JSON.parse(body.toString()));
      if(!name) return sendJSON(res,400,{error:'Name required'});
      let image_url=null;
      if(fileData&&fileData.buffer.length>0){
        const ext=path.extname(fileData.filename)||'.jpg';
        image_url=await sbUpload(`cat-${Date.now()}${ext}`,fileData.buffer,fileData.mimetype);
      }
      const slug=slugify(name);
      const data=await sb('POST','/rest/v1/categories',{name,description:description||'',image_url,featured:featured==='true',slug});
      return sendJSON(res,200,{success:true,category:data?.[0]});
    }
    const catM=pname.match(/^\/api\/admin\/categories\/(\d+)$/);
    if(catM&&method==='PUT'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const id=catM[1];
      const ct=req.headers['content-type']||'';
      const body=await readBody(req);
      let name,description,featured,fileData=null;
      if(ct.includes('multipart/form-data')){
        const bnd=ct.split('boundary=')[1];
        const{fields,file}=parseMultipart(body,bnd);
        ({name,description,featured}=fields);fileData=file;
      }else({name,description,featured}=JSON.parse(body.toString()));
      const existing=await sb('GET',`/rest/v1/categories?id=eq.${id}&select=*`);
      if(!existing?.length) return sendJSON(res,404,{error:'Not found'});
      let image_url=existing[0].image_url;
      if(fileData&&fileData.buffer.length>0){
        await sbDeleteFile(image_url);
        const ext=path.extname(fileData.filename)||'.jpg';
        image_url=await sbUpload(`cat-${Date.now()}${ext}`,fileData.buffer,fileData.mimetype);
      }
      const updates={image_url,updated_at:new Date().toISOString()};
      if(name){updates.name=name;updates.slug=slugify(name);}
      if(description!==undefined)updates.description=description;
      if(featured!==undefined)updates.featured=featured==='true';
      const data=await sb('PATCH',`/rest/v1/categories?id=eq.${id}`,updates);
      return sendJSON(res,200,{success:true,category:data?.[0]});
    }
    if(catM&&method==='DELETE'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const id=catM[1];
      const existing=await sb('GET',`/rest/v1/categories?id=eq.${id}&select=*`);
      if(existing?.length) await sbDeleteFile(existing[0].image_url);
      await sb('DELETE',`/rest/v1/categories?id=eq.${id}`);
      return sendJSON(res,200,{success:true});
    }

    // ════════════════════════════════════════════════
    // ADMIN: PRODUCTS
    // ════════════════════════════════════════════════

    if(pname==='/api/admin/products'&&method==='GET'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const data=await sb('GET','/rest/v1/products?select=*,categories(id,name),product_images(image_url,display_order)&order=created_at.desc');
      return sendJSON(res,200,data||[]);
    }

    if(pname==='/api/admin/products'&&method==='POST'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const ct=req.headers['content-type']||'';
      const body=await readBody(req);
      let fields={},files=[];
      if(ct.includes('multipart/form-data')){
        const bnd=ct.split('boundary=')[1];
        const parsed=parseMultipart(body,bnd);
        fields=parsed.fields;files=parsed.files;
      }else fields=JSON.parse(body.toString());

      const{name,category_id,description,price_range,gold_purity,weight,stone_type,featured,stock_status}=fields;
      if(!name) return sendJSON(res,400,{error:'Product name required'});
      const slug=fields.slug||slugify(name)+'-'+Date.now();

      // Upload thumbnail (first image)
      let thumbnail=null;
      if(files.length>0&&files[0].buffer.length>0){
        const ext=path.extname(files[0].filename)||'.jpg';
        thumbnail=await sbUpload(`prod-${Date.now()}-0${ext}`,files[0].buffer,files[0].mimetype);
      }

      const product=await sb('POST','/rest/v1/products',{
        name,slug,description:description||'',price_range:price_range||'',
        gold_purity:gold_purity||'22K',weight:weight||'',stone_type:stone_type||'',
        category_id:category_id?parseInt(category_id):null,
        thumbnail,featured:featured==='true',
        stock_status:stock_status||'available'
      });
      const prod=product?.[0];

      // Upload additional images
      if(prod&&files.length>0){
        for(let i=0;i<files.length;i++){
          if(files[i].buffer.length===0)continue;
          const ext=path.extname(files[i].filename)||'.jpg';
          const imgUrl=await sbUpload(`prod-${prod.id}-${i}-${Date.now()}${ext}`,files[i].buffer,files[i].mimetype);
          await sb('POST','/rest/v1/product_images',{product_id:prod.id,image_url:imgUrl,display_order:i});
        }
      }
      return sendJSON(res,200,{success:true,product:prod});
    }

    const prodAdminM=pname.match(/^\/api\/admin\/products\/(\d+)$/);
    if(prodAdminM&&method==='PUT'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const id=prodAdminM[1];
      const ct=req.headers['content-type']||'';
      const body=await readBody(req);
      let fields={},files=[];
      if(ct.includes('multipart/form-data')){
        const bnd=ct.split('boundary=')[1];
        const parsed=parseMultipart(body,bnd);
        fields=parsed.fields;files=parsed.files;
      }else fields=JSON.parse(body.toString());

      const existing=await sb('GET',`/rest/v1/products?id=eq.${id}&select=*`);
      if(!existing?.length) return sendJSON(res,404,{error:'Not found'});

      let thumbnail=existing[0].thumbnail;
      if(files.length>0&&files[0].buffer.length>0){
        const ext=path.extname(files[0].filename)||'.jpg';
        thumbnail=await sbUpload(`prod-${id}-thumb-${Date.now()}${ext}`,files[0].buffer,files[0].mimetype);
      }

      const updates={thumbnail,updated_at:new Date().toISOString()};
      const map={name:1,description:1,price_range:1,gold_purity:1,weight:1,stone_type:1,stock_status:1};
      Object.keys(map).forEach(k=>{if(fields[k]!==undefined)updates[k]=fields[k];});
      if(fields.category_id)updates.category_id=parseInt(fields.category_id);
      if(fields.featured!==undefined)updates.featured=fields.featured==='true';
      if(fields.slug)updates.slug=fields.slug;

      const data=await sb('PATCH',`/rest/v1/products?id=eq.${id}`,updates);

      // Upload extra images if provided
      if(files.length>1){
        for(let i=1;i<files.length;i++){
          if(files[i].buffer.length===0)continue;
          const ext=path.extname(files[i].filename)||'.jpg';
          const imgUrl=await sbUpload(`prod-${id}-${i}-${Date.now()}${ext}`,files[i].buffer,files[i].mimetype);
          await sb('POST','/rest/v1/product_images',{product_id:parseInt(id),image_url:imgUrl,display_order:i});
        }
      }
      return sendJSON(res,200,{success:true,product:data?.[0]});
    }

    if(prodAdminM&&method==='DELETE'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const id=prodAdminM[1];
      // Delete images from storage
      const imgs=await sb('GET',`/rest/v1/product_images?product_id=eq.${id}&select=*`);
      if(imgs?.length) await Promise.all(imgs.map(i=>sbDeleteFile(i.image_url)));
      const prod=await sb('GET',`/rest/v1/products?id=eq.${id}&select=thumbnail`);
      if(prod?.[0]?.thumbnail) await sbDeleteFile(prod[0].thumbnail);
      await sb('DELETE',`/rest/v1/product_images?product_id=eq.${id}`);
      await sb('DELETE',`/rest/v1/products?id=eq.${id}`);
      return sendJSON(res,200,{success:true});
    }

    // Delete single product image
    const prodImgM=pname.match(/^\/api\/admin\/product-images\/(\d+)$/);
    if(prodImgM&&method==='DELETE'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const imgId=prodImgM[1];
      const img=await sb('GET',`/rest/v1/product_images?id=eq.${imgId}&select=*`);
      if(img?.[0]) await sbDeleteFile(img[0].image_url);
      await sb('DELETE',`/rest/v1/product_images?id=eq.${imgId}`);
      return sendJSON(res,200,{success:true});
    }

    // ════════════════════════════════════════════════
    // ADMIN: ENQUIRIES
    // ════════════════════════════════════════════════

    if(pname==='/api/admin/enquiries'&&method==='GET'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const data=await sb('GET','/rest/v1/enquiries?select=*&order=created_at.desc');
      return sendJSON(res,200,data||[]);
    }
    const enqM=pname.match(/^\/api\/admin\/enquiries\/(\d+)$/);
    if(enqM&&method==='PUT'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const{status}=JSON.parse((await readBody(req)).toString());
      await sb('PATCH',`/rest/v1/enquiries?id=eq.${enqM[1]}`,{status});
      return sendJSON(res,200,{success:true});
    }
    if(enqM&&method==='DELETE'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      await sb('DELETE',`/rest/v1/enquiries?id=eq.${enqM[1]}`);
      return sendJSON(res,200,{success:true});
    }

    // ADMIN: change password
    if(pname==='/api/admin/password'&&method==='PUT'){
      if(!requireAuth(req)) return sendJSON(res,401,{error:'Unauthorized'});
      const{currentPassword,newPassword}=JSON.parse((await readBody(req)).toString());
      const storedHash=process.env.ADMIN_PASSWORD_HASH;
      const adminPass=process.env.ADMIN_PASSWORD||'admin123';
      const ok=storedHash?verifyPassword(currentPassword,storedHash):currentPassword===adminPass;
      if(!ok) return sendJSON(res,400,{error:'Current password incorrect'});
      console.log('\n🔑 ADMIN_PASSWORD_HASH='+hashPassword(newPassword)+'\n');
      return sendJSON(res,200,{success:true});
    }

    // ════════════════════════════════════════════════
    // STATIC FILES
    // ════════════════════════════════════════════════

    // Admin panel — all /admin/* routes
    if(pname==='/admin'||pname.startsWith('/admin/')){
      const ap=pname==='/admin'?'/admin/index.html':pname;
      const fp=path.join(__dirname,ap);
      return serveFile(res,fs.existsSync(fp)&&path.extname(fp)?fp:path.join(__dirname,'admin','index.html'));
    }

    // Public collection page: /collection/:slug
    if(pname.startsWith('/collection/')){
      return serveFile(res,path.join(__dirname,'public','collection.html'));
    }

    // Public product page: /product/:slug
    if(pname.startsWith('/product/')){
      return serveFile(res,path.join(__dirname,'public','product.html'));
    }

    // Homepage
    if(pname==='/'||pname==='/index.html')
      return serveFile(res,path.join(__dirname,'public','index.html'));

    // Other static assets
    const sp=path.join(__dirname,'public',pname);
    if(fs.existsSync(sp)&&!fs.statSync(sp).isDirectory())
      return serveFile(res,sp);

    res.writeHead(404);res.end('Not found');

  }catch(err){
    console.error('Error:',err.message);
    sendJSON(res,500,{error:err.message});
  }

}).listen(PORT,()=>{
  console.log(`\n✨ Thoppil Jewellery — Full Catalogue`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`🔐 Admin: http://localhost:${PORT}/admin`);
  if(!sbUrl()) console.warn('⚠️  SUPABASE_URL not set!\n');
  else console.log(`✅ Supabase: ${sbUrl()}\n`);
});
