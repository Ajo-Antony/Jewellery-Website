/* ════════════════════════════════════════════════════════════
   THOPPIL JEWELLERY — Main JavaScript
   ════════════════════════════════════════════════════════════ */

// ── Loader ────────────────────────────────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
    // Trigger hero reveals after loader hides
    document.querySelectorAll('#hero .reveal, #hero .reveal-right').forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), i * 180);
    });
  }, 1400);
});

// ── Navbar scroll ─────────────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// ── Mobile nav ────────────────────────────────────────────────
document.getElementById('mobileToggle').addEventListener('click', () => {
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Smooth close mobile menu on link click ────────────────────
document.querySelectorAll('#mobileMenu a').forEach(a => {
  a.addEventListener('click', () => document.getElementById('mobileMenu').classList.remove('open'));
});

// ── Intersection Observer – Reveal on scroll ──────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

function observeRevealElements() {
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
    // Skip hero elements already handled by loader
    if (!el.closest('#hero')) revealObserver.observe(el);
  });
}
observeRevealElements();

// ── Counter animation ─────────────────────────────────────────
function animateCounter(el, target, duration = 1800) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = Math.floor(start).toLocaleString();
    if (start >= target) clearInterval(timer);
  }, 16);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const target = parseInt(entry.target.dataset.count);
      animateCounter(entry.target, target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.hc-num[data-count]').forEach(el => counterObserver.observe(el));

// ── Load Collections from API ──────────────────────────────────
const PLACEHOLDER_ICONS = ['◈', '✦', '⬡', '◉', '❖', '✿'];
const PLACEHOLDER_LABELS = ['Collection', 'Jewellery', 'Gold', 'Diamond'];

async function loadCollections() {
  const grid = document.getElementById('collectionsGrid');
  try {
    const res = await fetch('/api/categories');
    const categories = await res.json();

    grid.innerHTML = '';

    if (!categories.length) {
      grid.innerHTML = `<div class="collections-loading"><p style="color:var(--text-muted)">No collections yet. Add some from the admin panel.</p></div>`;
      return;
    }

    categories.forEach((cat, i) => {
      const card = document.createElement('div');
      card.className = 'collection-card';
      card.style.animationDelay = `${i * 0.1}s`;

      const imgHTML = cat.image
        ? `<img class="cc-img" src="${cat.image}" alt="${cat.name}" loading="lazy" />`
        : `<div class="cc-placeholder">
            <div class="cc-placeholder-icon">${PLACEHOLDER_ICONS[i % PLACEHOLDER_ICONS.length]}</div>
            <span>${PLACEHOLDER_LABELS[i % PLACEHOLDER_LABELS.length]}</span>
           </div>`;

      card.innerHTML = `
        ${cat.featured ? '<div class="cc-featured-tag">Featured</div>' : ''}
        ${imgHTML}
        <div class="cc-overlay">
          <div class="cc-name">${escapeHTML(cat.name)}</div>
          <div class="cc-desc">${escapeHTML(cat.description || '')}</div>
        </div>
        <div class="cc-arrow">→</div>
      `;
      grid.appendChild(card);
    });

  } catch (err) {
    grid.innerHTML = `<div class="collections-loading"><p style="color:var(--text-muted)">Could not load collections.</p></div>`;
  }
}

loadCollections();

// ── Contact form ──────────────────────────────────────────────
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('formMsg');
  const btn = document.getElementById('enquiryBtn');
  const name    = document.getElementById('enquiryName').value.trim();
  const phone   = document.getElementById('enquiryPhone').value.trim();
  const email   = document.getElementById('enquiryEmail').value.trim();
  const message = document.getElementById('enquiryMessage').value.trim();

  btn.textContent = 'Sending…';
  btn.disabled = true;
  msg.style.color = 'var(--gold)';

  try {
    const res = await fetch('/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, message })
    });
    const data = await res.json();
    if (data.success) {
      msg.textContent = '✓ Enquiry sent! We will contact you soon.';
      e.target.reset();
    } else {
      msg.style.color = '#e05555';
      msg.textContent = data.error || 'Failed to send. Please try again.';
    }
  } catch {
    msg.style.color = '#e05555';
    msg.textContent = 'Network error. Please try again.';
  } finally {
    btn.textContent = 'Send Enquiry';
    btn.disabled = false;
    setTimeout(() => msg.textContent = '', 6000);
  }
});

// ── Utility ───────────────────────────────────────────────────
function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
