/* ════════════════════════════════════════════════════════════
   THOPPIL — Product Detail Page JS
   ════════════════════════════════════════════════════════════ */

const WHATSAPP_NUMBER = '919999900000';
const PLACEHOLDER_ICONS = ['◈','✦','⬡','◉','❖'];

// ── Navbar ─────────────────────────────────────────────────────
document.getElementById('navbar').classList.add('scrolled');
document.getElementById('mobileToggle').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Get slug from URL ──────────────────────────────────────────
function getSlug() {
  const parts = window.location.pathname.split('/');
  return decodeURIComponent(parts[parts.length - 1] || '');
}

// ── Load Product ───────────────────────────────────────────────
async function loadProduct() {
  const slug = getSlug();
  if (!slug) { showError(); return; }

  try {
    const res = await fetch(`/api/products/slug/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error('Not found');
    const { product, related } = await res.json();

    renderProduct(product);
    if (related?.length) renderRelated(related);

    // Hide skeleton, show detail
    document.getElementById('productSkeleton').style.display = 'none';
    document.getElementById('productDetail').style.display = 'block';

  } catch (err) {
    showError();
  }
}

// ── Render Product ─────────────────────────────────────────────
function renderProduct(p) {
  const images = p.product_images || [];
  const allImgs = [
    ...(p.thumbnail ? [p.thumbnail] : []),
    ...images.sort((a, b) => a.display_order - b.display_order).map(i => i.image_url)
  ];
  // Deduplicate
  const uniqueImgs = [...new Set(allImgs)];

  // Meta
  document.title = `${p.name} – Thoppil Jewellery`;

  // Breadcrumb
  const catName = p.categories?.name || 'Collections';
  const catSlug = p.categories?.slug || '';
  const catEl = document.getElementById('prodBreadCat');
  catEl.textContent = catName;
  catEl.href = catSlug ? `/collection/${catSlug}` : '/#collections';
  document.getElementById('prodBreadName').textContent = p.name;

  // Category tag
  document.getElementById('prodCatTag').textContent = catName;

  // Title
  document.getElementById('prodTitle').textContent = p.name;

  // Stock
  const stockEl = document.getElementById('prodStock');
  const statusMap = { available: 'Available', made_to_order: 'Made to Order', out_of_stock: 'Out of Stock' };
  stockEl.textContent = statusMap[p.stock_status] || 'Available';
  stockEl.className = `prod-stock ${p.stock_status || 'available'}`;

  // Price
  document.getElementById('prodPrice').textContent = p.price_range || 'Contact for price';

  // Specs
  if (p.gold_purity) document.getElementById('prodPurity').textContent = p.gold_purity;
  else document.getElementById('specPurity').style.display = 'none';
  if (p.weight) document.getElementById('prodWeight').textContent = p.weight;
  else document.getElementById('specWeight').style.display = 'none';
  if (p.stone_type) document.getElementById('prodStone').textContent = p.stone_type;
  else document.getElementById('specStone').style.display = 'none';

  // Description
  document.getElementById('prodDesc').textContent = p.description || 'A beautifully crafted piece from our Kerala heritage collection.';

  // WhatsApp
  const waMsg = encodeURIComponent(`Hi, I am interested in the *${p.name}* from THOPPIL Jewellery, Kottayam. Kindly share more details and current pricing.`);
  document.getElementById('whatsappBtn').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${waMsg}`;

  // Gallery
  if (uniqueImgs.length > 0) {
    setMainImage(uniqueImgs[0]);
    renderThumbs(uniqueImgs);
  } else {
    document.getElementById('mainImg').style.display = 'none';
    document.getElementById('mainImgWrap').style.background = 'var(--bg-3)';
    document.getElementById('mainImgWrap').innerHTML += `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <div style="font-size:5rem;color:rgba(201,169,110,.15)">◈</div>
      </div>`;
  }
}

// ── Gallery ─────────────────────────────────────────────────────
function setMainImage(url) {
  const img = document.getElementById('mainImg');
  img.src = url;
  img.alt = document.getElementById('prodTitle').textContent;
}

function renderThumbs(imgs) {
  const container = document.getElementById('prodThumbs');
  if (imgs.length <= 1) { container.style.display = 'none'; return; }
  container.innerHTML = imgs.map((url, i) => `
    <img class="prod-thumb ${i === 0 ? 'active' : ''}"
         src="${url}" alt="Product image ${i+1}"
         loading="lazy"
         onclick="switchThumb('${url}', this)"/>
  `).join('');
}

function switchThumb(url, el) {
  setMainImage(url);
  document.querySelectorAll('.prod-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

// Image zoom on hover
const mainWrap = document.getElementById('mainImgWrap');
if (mainWrap) {
  mainWrap.addEventListener('mousemove', (e) => {
    const rect = mainWrap.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const img = document.getElementById('mainImg');
    if (img) {
      img.style.transformOrigin = `${x}% ${y}%`;
      img.style.transform = 'scale(1.5)';
    }
  });
  mainWrap.addEventListener('mouseleave', () => {
    const img = document.getElementById('mainImg');
    if (img) img.style.transform = '';
  });
}

// ── Related Products ───────────────────────────────────────────
function renderRelated(products) {
  const section = document.getElementById('relatedSection');
  const grid = document.getElementById('relatedGrid');
  section.style.display = 'block';

  grid.innerHTML = products.map((p, i) => {
    const imgUrl = p.thumbnail;
    return `
      <div class="prod-card" style="animation-delay:${i * 0.1}s">
        <div class="prod-card-img-wrap">
          ${imgUrl
            ? `<img class="prod-card-img" src="${imgUrl}" alt="${escHTML(p.name)}" loading="lazy"/>`
            : `<div class="prod-card-placeholder">
                <div class="prod-card-placeholder-icon">${PLACEHOLDER_ICONS[i % PLACEHOLDER_ICONS.length]}</div>
                <span>Jewellery</span>
               </div>`
          }
          <div class="prod-card-overlay">
            <a class="prod-card-view" href="/product/${p.slug || p.id}" style="flex:1">View Details</a>
          </div>
        </div>
        <div class="prod-card-info">
          <div class="prod-card-name">${escHTML(p.name)}</div>
          <div class="prod-card-meta">
            <span class="prod-card-purity">${escHTML(p.gold_purity || '22K')}</span>
            <span class="prod-card-price">${escHTML(p.price_range || '')}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Recently viewed ────────────────────────────────────────────
function saveRecentlyViewed(slug, name) {
  try {
    let rv = JSON.parse(localStorage.getItem('tj_recently_viewed') || '[]');
    rv = rv.filter(i => i.slug !== slug);
    rv.unshift({ slug, name, ts: Date.now() });
    rv = rv.slice(0, 10);
    localStorage.setItem('tj_recently_viewed', JSON.stringify(rv));
  } catch {}
}

// ── Helpers ────────────────────────────────────────────────────
function escHTML(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showError() {
  document.getElementById('productSkeleton').style.display = 'none';
  document.getElementById('productDetail').style.display = 'block';
  document.getElementById('prodTitle').textContent = 'Product Not Found';
  document.getElementById('prodDesc').textContent = 'This product could not be found. Please go back to collections.';
  document.getElementById('prodPrice').textContent = '';
}

// ── Init ───────────────────────────────────────────────────────
loadProduct();
