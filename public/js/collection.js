/* ════════════════════════════════════════════════════════════
   THOPPIL — Collection Page JS
   ════════════════════════════════════════════════════════════ */

const WHATSAPP_NUMBER = '919999900000';
let allProducts = [];
let currentCategory = null;
const PLACEHOLDER_ICONS = ['◈','✦','⬡','◉','❖'];

// ── Get slug from URL ──────────────────────────────────────────
function getSlug() {
  const parts = window.location.pathname.split('/');
  return parts[parts.length - 1] || '';
}

// ── Navbar scroll ──────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });
document.getElementById('navbar').classList.add('scrolled');

// ── Mobile nav ─────────────────────────────────────────────────
document.getElementById('mobileToggle').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Load Collection ────────────────────────────────────────────
async function loadCollection() {
  const slug = getSlug();
  if (!slug) { showError('Collection not found.'); return; }

  try {
    const res = await fetch(`/api/products/category/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error('Not found');
    const { category, products } = await res.json();

    currentCategory = category;
    allProducts = products;

    // Update page title
    document.title = `${category.name} – Thoppil Jewellery`;

    // Hero
    document.getElementById('breadcrumbCat').textContent = category.name;
    document.getElementById('colTitle').textContent = category.name;
    document.getElementById('colDesc').textContent = category.description || '';
    document.getElementById('productCount').textContent = `${products.length} piece${products.length !== 1 ? 's' : ''}`;

    // Hero background image
    if (category.image_url) {
      const heroImg = document.getElementById('heroImg');
      heroImg.style.backgroundImage = `url('${category.image_url}')`;
      setTimeout(() => heroImg.classList.add('loaded'), 100);
    }

    renderProducts(products);

  } catch (err) {
    showError('This collection could not be loaded.');
  }
}

// ── Render Products ────────────────────────────────────────────
function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  const empty = document.getElementById('emptyState');

  if (!products.length) {
    grid.innerHTML = '';
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  empty.style.display = 'none';

  grid.innerHTML = products.map((p, i) => {
    const images = p.product_images || [];
    const imgUrl = p.thumbnail || (images[0]?.image_url) || null;
    const slug = p.slug || p.id;

    return `
      <div class="prod-card" style="animation-delay:${i * 0.07}s">
        <div class="prod-card-img-wrap">
          ${p.featured ? '<div class="prod-card-featured">Featured</div>' : ''}
          ${p.stock_status === 'out_of_stock' ? '<div class="prod-card-status-oos">Out of Stock</div>' : ''}
          ${imgUrl
            ? `<img class="prod-card-img" src="${imgUrl}" alt="${escHTML(p.name)}" loading="lazy"/>`
            : `<div class="prod-card-placeholder">
                <div class="prod-card-placeholder-icon">${PLACEHOLDER_ICONS[i % PLACEHOLDER_ICONS.length]}</div>
                <span>Jewellery</span>
               </div>`
          }
          <div class="prod-card-overlay">
            <button class="prod-card-qv" onclick="openQuickView(${p.id})">Quick View</button>
            <a class="prod-card-view" href="/product/${slug}">View Details</a>
          </div>
        </div>
        <div class="prod-card-info">
          <div class="prod-card-name">${escHTML(p.name)}</div>
          <div class="prod-card-meta">
            <span class="prod-card-purity">${escHTML(p.gold_purity || '22K')}</span>
            <span class="prod-card-price">${escHTML(p.price_range || 'Contact for price')}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Intersection observer for scroll reveal
  document.querySelectorAll('.prod-card').forEach(card => {
    revealObserver.observe(card);
  });
}

// ── Scroll reveal ──────────────────────────────────────────────
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.style.opacity = '1'; revealObserver.unobserve(e.target); } });
}, { threshold: 0.1 });

// ── Filter ─────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
  });
});

document.getElementById('searchInput').addEventListener('input', applyFilters);

function applyFilters() {
  const filter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
  const search = document.getElementById('searchInput').value.toLowerCase();

  let filtered = allProducts;
  if (filter === 'featured')  filtered = filtered.filter(p => p.featured);
  if (filter === 'available') filtered = filtered.filter(p => p.stock_status === 'available');
  if (search) filtered = filtered.filter(p =>
    p.name.toLowerCase().includes(search) ||
    (p.description || '').toLowerCase().includes(search) ||
    (p.gold_purity || '').toLowerCase().includes(search) ||
    (p.stone_type || '').toLowerCase().includes(search)
  );

  renderProducts(filtered);
}

// ── Quick View ─────────────────────────────────────────────────
async function openQuickView(id) {
  const overlay = document.getElementById('qvOverlay');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const res = await fetch(`/api/products/${id}`);
    const product = await res.json();
    const images = product.product_images || [];
    const allImgs = [
      ...(product.thumbnail ? [{ image_url: product.thumbnail }] : []),
      ...images.sort((a, b) => a.display_order - b.display_order)
    ];

    // Remove duplicate thumbnail
    const uniqueImgs = allImgs.filter((img, i, arr) =>
      arr.findIndex(x => x.image_url === img.image_url) === i
    );

    // Set main image
    const mainImg = document.getElementById('qvMainImg');
    if (uniqueImgs.length) {
      mainImg.style.backgroundImage = `url('${uniqueImgs[0].image_url}')`;
    } else {
      mainImg.style.background = 'var(--bg-3)';
    }

    // Thumbs
    const thumbsEl = document.getElementById('qvThumbs');
    thumbsEl.innerHTML = uniqueImgs.map((img, i) => `
      <div class="qv-thumb ${i === 0 ? 'active' : ''}"
           style="background-image:url('${img.image_url}')"
           onclick="setQvImg('${img.image_url}', this)"></div>
    `).join('');

    // Details
    document.getElementById('qvCat').textContent = product.categories?.name || '';
    document.getElementById('qvName').textContent = product.name;
    document.getElementById('qvPurity').textContent = product.gold_purity || '—';
    document.getElementById('qvWeight').textContent = product.weight || '—';
    document.getElementById('qvStone').textContent = product.stone_type || '—';
    document.getElementById('qvStatus').textContent = formatStatus(product.stock_status);
    document.getElementById('qvPrice').textContent = product.price_range || 'Contact for price';
    document.getElementById('qvDesc').textContent = (product.description || '').substring(0, 200) + (product.description?.length > 200 ? '…' : '');

    const waMsg = encodeURIComponent(`Hi, I am interested in the ${product.name} from THOPPIL Jewellery, Kottayam. Please share more details.`);
    document.getElementById('qvWhatsapp').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${waMsg}`;
    document.getElementById('qvViewFull').href = `/product/${product.slug || product.id}`;

  } catch (err) {
    document.getElementById('qvName').textContent = 'Could not load product';
  }
}

function setQvImg(url, el) {
  document.getElementById('qvMainImg').style.backgroundImage = `url('${url}')`;
  document.querySelectorAll('.qv-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

document.getElementById('qvClose').addEventListener('click', closeQV);
document.getElementById('qvOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeQV();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeQV(); });

function closeQV() {
  document.getElementById('qvOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Helpers ────────────────────────────────────────────────────
function formatStatus(s) {
  return { available: 'Available', made_to_order: 'Made to Order', out_of_stock: 'Out of Stock' }[s] || s;
}
function escHTML(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showError(msg) {
  document.getElementById('colTitle').textContent = 'Collection Not Found';
  document.getElementById('colDesc').textContent = msg;
  document.getElementById('productsGrid').innerHTML = '';
  document.getElementById('emptyState').style.display = 'block';
}

// ── Init ───────────────────────────────────────────────────────
loadCollection();
