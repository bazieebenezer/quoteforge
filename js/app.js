// app.js — Version non-module concaténée de tous les modules QuoteForge
// Ordre : toast → quote → calculator → history-manager → preview → history-ui → pdf-generator → script

/* ========================= toast.js ========================= */

const ICONS = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'info'
};

function showToast(message, type = 'info', duration = 3500) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;

  const icon = ICONS[type] || ICONS.info;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <i class="icon toast-icon" data-lucide="${icon}"></i>
    <div class="toast-msg">${escapeHtml(message)}</div>
    <button type="button" class="toast-close" aria-label="Fermer la notification">
      <i class="icon" data-lucide="x"></i>
    </button>
  `;

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    el.classList.add('toast-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };

  el.querySelector('.toast-close').addEventListener('click', dismiss);
  stack.appendChild(el);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  return dismiss;
}

/* ========================= quote.js ========================= */

function makeId() {
  return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function makeItemId() {
  return 'it_' + Math.random().toString(36).slice(2, 9);
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyQuote(number) {
  return {
    id: makeId(),
    number: number || 'DEV-0000',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    company: {
      name: '',
      address: '',
      phone: '',
      email: '',
      taxId: '',
      logo: null
    },
    client: {
      name: '',
      address: '',
      phone: '',
      email: ''
    },
    items: [
      { id: makeItemId(), description: '', qty: 1, unitPrice: 0 }
    ],
    currency: 'XOF',
    taxRate: 0,
    discountRate: 0,
    issueDate: todayISO(),
    validityDays: 30,
    notes: '',
    design: 'minimaliste',
    signature: null,
    signatureDate: null
  };
}

let state = emptyQuote();
const listeners = new Set();

function notify() {
  state.updatedAt = Date.now();
  listeners.forEach((fn) => fn(state));
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getState() {
  return state;
}

function replaceState(newState) {
  state = newState;
  notify();
}

function resetQuote(number) {
  state = emptyQuote(number);
  notify();
}

function updateCompany(partial) {
  Object.assign(state.company, partial);
  notify();
}

function updateClient(partial) {
  Object.assign(state.client, partial);
  notify();
}

function setLogo(dataUrl) {
  state.company.logo = dataUrl;
  notify();
}

function addItem() {
  state.items.push({ id: makeItemId(), description: '', qty: 1, unitPrice: 0 });
  notify();
}

function removeItem(itemId) {
  state.items = state.items.filter((it) => it.id !== itemId);
  if (state.items.length === 0) {
    state.items.push({ id: makeItemId(), description: '', qty: 1, unitPrice: 0 });
  }
  notify();
}

function updateItem(itemId, partial) {
  const item = state.items.find((it) => it.id === itemId);
  if (!item) return;
  Object.assign(item, partial);
  notify();
}

function setCurrency(currency) {
  state.currency = currency;
  notify();
}

function setTaxRate(rate) {
  state.taxRate = Number.isFinite(rate) ? rate : 0;
  notify();
}

function setDiscountRate(rate) {
  state.discountRate = Number.isFinite(rate) ? rate : 0;
  notify();
}

function setIssueDate(dateStr) {
  state.issueDate = dateStr;
  notify();
}

function setValidityDays(days) {
  state.validityDays = Number.isFinite(days) ? days : 30;
  notify();
}

function setNotes(text) {
  state.notes = text;
  notify();
}

function setNumber(number) {
  state.number = number;
  notify();
}

function setDesign(name) {
  state.design = name;
  notify();
}

function setSignature(dataUrl) {
  state.signature = dataUrl;
  state.signatureDate = dataUrl ? new Date().toISOString() : null;
  notify();
}

function cloneState() {
  return JSON.parse(JSON.stringify(state));
}

/* ========================= calculator.js ========================= */

function lineTotal(item) {
  const qty = Number(item.qty) || 0;
  const price = Number(item.unitPrice) || 0;
  return qty * price;
}

function subtotal(items) {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

function discountAmount(subtotalValue, discountRate) {
  const rate = Number(discountRate) || 0;
  return subtotalValue * (rate / 100);
}

function taxAmount(baseValue, taxRate) {
  const rate = Number(taxRate) || 0;
  return baseValue * (rate / 100);
}

function computeTotals(quote) {
  const sub = subtotal(quote.items);
  const discount = discountAmount(sub, quote.discountRate);
  const base = sub - discount;
  const tax = taxAmount(base, quote.taxRate);
  const total = base + tax;
  return { subtotal: sub, discount, base, tax, total };
}

const CURRENCY_LOCALE = {
  XOF: 'fr-FR',
  EUR: 'fr-FR',
  USD: 'en-US'
};

function formatCurrency(amount, currency) {
  const value = Number(amount) || 0;
  const locale = CURRENCY_LOCALE[currency] || 'fr-FR';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'XOF',
      maximumFractionDigits: currency === 'XOF' ? 0 : 2,
      minimumFractionDigits: currency === 'XOF' ? 0 : 2
    }).format(value);
  } catch (e) {
    return value.toFixed(2) + ' ' + (currency || '');
  }
}

function formatNumber(amount) {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
}

function addDays(isoDateStr, days) {
  const base = isoDateStr ? new Date(isoDateStr) : new Date();
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + (Number(days) || 0));
  const pad = (n) => String(n).padStart(2, '0');
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

function formatDateFR(isoDateStr) {
  if (!isoDateStr) return '—';
  const d = new Date(isoDateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
}

/* ========================= history-manager.js ========================= */

const KEY_HISTORY = 'quoteforge_history';
const KEY_COUNTER = 'quoteforge_counter';
const KEY_LAST_ACTIVE = 'quoteforge_last_active_id';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('QuoteForge: lecture localStorage impossible pour', key, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('QuoteForge: écriture localStorage impossible pour', key, e);
    return false;
  }
}

function getNextNumber() {
  const counter = (readJSON(KEY_COUNTER, 0) || 0) + 1;
  writeJSON(KEY_COUNTER, counter);
  const year = new Date().getFullYear();
  return `DEV-${year}-${String(counter).padStart(4, '0')}`;
}

function getAllQuotes() {
  const list = readJSON(KEY_HISTORY, []);
  if (!Array.isArray(list)) return [];
  return list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function getQuoteById(id) {
  return getAllQuotes().find((q) => q.id === id) || null;
}

function saveQuote(quote) {
  const list = readJSON(KEY_HISTORY, []);
  const arr = Array.isArray(list) ? list : [];
  const idx = arr.findIndex((q) => q.id === quote.id);
  const snapshot = JSON.parse(JSON.stringify(quote));
  if (idx >= 0) {
    arr[idx] = snapshot;
  } else {
    arr.push(snapshot);
  }
  return writeJSON(KEY_HISTORY, arr);
}

function deleteQuote(id) {
  const list = readJSON(KEY_HISTORY, []);
  const arr = Array.isArray(list) ? list : [];
  const filtered = arr.filter((q) => q.id !== id);
  return writeJSON(KEY_HISTORY, filtered);
}

function getLastActiveId() {
  return readJSON(KEY_LAST_ACTIVE, null);
}

function setLastActiveId(id) {
  writeJSON(KEY_LAST_ACTIVE, id);
}

function hasAnyContent(quote) {
  const c = quote.company;
  const cl = quote.client;
  const hasItems = quote.items.some((it) => it.description.trim() || Number(it.unitPrice) > 0);
  return !!(c.name || c.address || c.phone || c.email || cl.name || cl.address || cl.phone || cl.email || hasItems || (quote.notes && quote.notes.trim()));
}

/* ========================= preview.js ========================= */

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(str) {
  return escapeHtml(str).replace(/\n/g, '<br>');
}

function renderCompanyBlock(company) {
  const logo = company.logo
    ? `<img class="paper-logo" src="${company.logo}" alt="Logo">`
    : `<div class="paper-logo-placeholder"><i class="icon" style="width:18px;height:18px;" data-lucide="building"></i></div>`;

  const metaLines = [];
  if (company.address) metaLines.push(escapeHtml(company.address));
  const contact = [company.phone, company.email].filter(Boolean).map(escapeHtml).join(' · ');
  if (contact) metaLines.push(contact);
  if (company.taxId) metaLines.push('ID fiscal : ' + escapeHtml(company.taxId));

  return `
    <div class="paper-company">
      ${logo}
      <div>
        <div class="paper-company-name">${escapeHtml(company.name) || 'Votre entreprise'}</div>
        <div class="paper-company-meta">${metaLines.join('<br>') || 'Renseignez vos coordonnées'}</div>
      </div>
    </div>
  `;
}

function renderDocTag(quote) {
  const validUntil = addDays(quote.issueDate, quote.validityDays);
  return `
    <div class="paper-doc-tag">
      <div class="paper-doc-title">DEVIS</div>
      <div class="paper-doc-number">N° ${escapeHtml(quote.number)}</div>
      <div class="paper-doc-dates">
        Émis le <span>${formatDateFR(quote.issueDate)}</span><br>
        Valable jusqu'au <span>${formatDateFR(validUntil)}</span>
      </div>
    </div>
  `;
}

function renderParty(label, entity, isClient) {
  const hasContent = entity.name || entity.address || entity.phone || entity.email;
  if (!hasContent) {
    return `
      <div>
        <div class="paper-party-label">${label}</div>
        <div class="paper-party-empty">${isClient ? "Renseignez le client" : "—"}</div>
      </div>
    `;
  }
  const metaLines = [];
  if (entity.address) metaLines.push(escapeHtml(entity.address));
  const contact = [entity.phone, entity.email].filter(Boolean).map(escapeHtml).join(' · ');
  if (contact) metaLines.push(contact);

  return `
    <div>
      <div class="paper-party-label">${label}</div>
      <div class="paper-party-name">${escapeHtml(entity.name) || '—'}</div>
      <div class="paper-party-meta">${metaLines.join('\n')}</div>
    </div>
  `;
}

function renderPreviewItemsTable(quote) {
  const realItems = quote.items.filter((it) => it.description.trim() || it.qty || it.unitPrice);
  if (realItems.length === 0) {
    return `<div class="paper-items-empty">Aucune prestation ajoutée pour le moment</div>`;
  }
  const rows = quote.items.map((item) => {
    const total = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
    return `
      <tr>
        <td class="desc">${escapeHtml(item.description) || '—'}</td>
        <td class="num tnum">${Number(item.qty) || 0}</td>
        <td class="num tnum">${formatCurrency(item.unitPrice, quote.currency)}</td>
        <td class="num tnum">${formatCurrency(total, quote.currency)}</td>
      </tr>
    `;
  }).join('');

  return `
    <table class="paper-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qté</th>
          <th class="num">Prix unit.</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderTotals(quote) {
  const t = computeTotals(quote);
  const rows = [];
  rows.push(`<div class="paper-total-row"><span>Sous-total</span><span class="tnum">${formatCurrency(t.subtotal, quote.currency)}</span></div>`);
  if (quote.discountRate > 0) {
    rows.push(`<div class="paper-total-row"><span>Remise (${quote.discountRate}%)</span><span class="tnum">−${formatCurrency(t.discount, quote.currency)}</span></div>`);
  }
  if (quote.taxRate > 0) {
    rows.push(`<div class="paper-total-row"><span>TVA (${quote.taxRate}%)</span><span class="tnum">${formatCurrency(t.tax, quote.currency)}</span></div>`);
  }
  rows.push(`<div class="paper-total-row grand"><span>Total</span><span class="amount tnum">${formatCurrency(t.total, quote.currency)}</span></div>`);

  return `
    <div class="paper-totals">
      <div class="paper-totals-inner">${rows.join('')}</div>
    </div>
  `;
}

function renderNotes(quote) {
  if (!quote.notes || !quote.notes.trim()) return '';
  return `
    <div class="paper-notes">
      <div class="paper-notes-label">Notes &amp; conditions</div>
      <div class="paper-notes-text">${nl2br(quote.notes)}</div>
    </div>
  `;
}

function renderPreview(quote) {
  const root = document.getElementById('quote-preview');
  if (!root) return;

  root.className = 'paper' + (quote.design && quote.design !== 'minimaliste' ? ' design-' + quote.design : '');

  root.innerHTML = `
    <div class="paper-head">
      ${renderCompanyBlock(quote.company)}
      ${renderDocTag(quote)}
    </div>
    <div class="paper-parties">
      ${renderParty('Émetteur', quote.company, false)}
      ${renderParty('Destinataire', quote.client, true)}
    </div>
    ${renderPreviewItemsTable(quote)}
    ${renderTotals(quote)}
    ${renderNotes(quote)}
    <div class="paper-sign">
      <div class="paper-sign-label">Cachet &amp; signature</div>
      ${quote.signature
        ? `<img class="paper-sign-img" src="${quote.signature}" alt="Signature">`
        : `<div class="paper-sign-placeholder"></div>`
      }
      ${quote.signatureDate
        ? `<div class="paper-sign-date">Signé le ${formatDateFR(quote.signatureDate.split('T')[0])}</div>`
        : ''
      }
    </div>
    <div class="paper-foot-note">« La simplicité est la sophistication suprême. » - Léonard de Vinci</div>
  `;

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function initPreview() {
  renderPreview(getState());
  subscribe(renderPreview);
}

/* ========================= history-ui.js ========================= */

function formatRelative(ts) {
  if (!ts) return '';
  const diffMs = Date.now() - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "à l'instant";
  if (diffMs < hour) return `il y a ${Math.floor(diffMs / minute)} min`;
  if (diffMs < day) return `il y a ${Math.floor(diffMs / hour)} h`;
  if (diffMs < 2 * day) return 'hier';

  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(ts));
}

function renderHistoryList(activeId, onLoad) {
  const container = document.getElementById('history-list');
  if (!container) return;

  const quotes = getAllQuotes();
  container.innerHTML = '';

  if (quotes.length === 0) {
    container.innerHTML = `
      <div class="history-empty">
        <i class="icon" data-lucide="inbox"></i>
        <p>Aucun devis enregistré pour l'instant. Vos devis apparaîtront ici automatiquement.</p>
      </div>
    `;
    return;
  }

  quotes.forEach((q) => {
    const totals = computeTotals(q);
    const row = document.createElement('div');
    row.className = 'history-row' + (q.id === activeId ? ' is-active' : '');
    row.innerHTML = `
      <div class="history-row-main">
        <div class="history-row-number">${escapeHtml(q.number)}</div>
        <div class="history-row-client">${escapeHtml(q.client.name) || 'Client non renseigné'}</div>
        <div class="history-row-meta">Modifié ${formatRelative(q.updatedAt)}</div>
      </div>
      <div class="history-row-amount tnum">${formatCurrency(totals.total, q.currency)}</div>
      <button type="button" class="history-row-delete" title="Supprimer ce devis">
        <i class="icon" data-lucide="trash-2"></i>
      </button>
    `;

    row.querySelector('.history-row-main').addEventListener('click', () => onLoad(q));

    const delBtn = row.querySelector('.history-row-delete');
    let confirming = false;
    let confirmTimeout = null;

    delBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!confirming) {
        confirming = true;
        delBtn.classList.add('is-confirming');
        delBtn.textContent = 'Confirmer';
        confirmTimeout = setTimeout(() => {
          confirming = false;
          delBtn.classList.remove('is-confirming');
          delBtn.innerHTML = '<i class="icon" data-lucide="trash-2"></i>';
        }, 4000);
        return;
      }
      clearTimeout(confirmTimeout);
      deleteQuote(q.id);
      showToast('Devis supprimé', 'info');
      renderHistoryList(activeId === q.id ? null : activeId, onLoad);
    });

    container.appendChild(row);
  });
}

/* ========================= pdf-generator.js ========================= */

function sanitize(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

function buildFilename(quote) {
  const number = sanitize(quote.number) || 'devis';
  const client = sanitize(quote.client.name) || 'client';
  return `${number}_${client}.pdf`;
}

function getBreakSegments(root) {
  const segments = [];

  const head = root.querySelector('.paper-head');
  if (head) segments.push(head);

  const parties = root.querySelector('.paper-parties');
  if (parties) segments.push(parties);

  const thead = root.querySelector('.paper-table thead');
  if (thead) segments.push(thead);

  const itemsEmpty = root.querySelector('.paper-items-empty');
  if (itemsEmpty) segments.push(itemsEmpty);

  root.querySelectorAll('.paper-table tbody tr').forEach((tr) => segments.push(tr));

  ['.paper-totals', '.paper-notes', '.paper-sign', '.paper-foot-note'].forEach((sel) => {
    const el = root.querySelector(sel);
    if (el) segments.push(el);
  });

  return segments;
}

function computeSafeBreaks(segments, rootRect, scaleFactor, pageHeightPx, totalHeightPx) {
  const rects = segments
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        top: (r.top - rootRect.top) * scaleFactor,
        bottom: (r.bottom - rootRect.top) * scaleFactor
      };
    })
    .sort((a, b) => a.top - b.top);

  const breaks = [0];
  let pageStart = 0;

  for (const seg of rects) {
    if (seg.bottom - pageStart <= pageHeightPx) continue;

    const segHeight = seg.bottom - seg.top;

    if (segHeight <= pageHeightPx && seg.top > pageStart) {
      breaks.push(seg.top);
      pageStart = seg.top;
    } else if (segHeight > pageHeightPx) {
      let cut = pageStart + pageHeightPx;
      while (cut < seg.bottom) {
        breaks.push(cut);
        pageStart = cut;
        cut += pageHeightPx;
      }
    }
  }

  breaks.push(totalHeightPx);
  return Array.from(new Set(breaks.map((n) => Math.round(n)))).sort((a, b) => a - b);
}

async function generatePdf(quote) {
  if (typeof window.html2canvas !== 'function' || !window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('Les bibliothèques PDF ne sont pas chargées (vérifiez votre connexion internet).');
  }

  const node = document.getElementById('quote-preview');
  if (!node) {
    throw new Error('Aperçu introuvable.');
  }

  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) { /* on continue malgré tout */ }
  }

  const rootRect = node.getBoundingClientRect();

  const canvas = await window.html2canvas(node, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: document.documentElement.scrollHeight
  });

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();

  const pxPerMm = canvas.width / pageWidthMm;
  const pageHeightPx = pageHeightMm * pxPerMm;
  const scaleFactor = canvas.width / rootRect.width;

  const segments = getBreakSegments(node);
  const breaks = segments.length > 0
    ? computeSafeBreaks(segments, rootRect, scaleFactor, pageHeightPx, canvas.height)
    : (() => {
      const fallback = [];
      for (let y = 0; y < canvas.height; y += pageHeightPx) fallback.push(y);
      fallback.push(canvas.height);
      return fallback;
    })();

  let pageCount = 0;
  for (let i = 0; i < breaks.length - 1; i++) {
    const sliceStartPx = breaks[i];
    const sliceHeightPx = breaks[i + 1] - sliceStartPx;
    if (sliceHeightPx <= 0) continue;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;
    const ctx = sliceCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(canvas, 0, sliceStartPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

    const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
    const sliceHeightMm = sliceHeightPx / pxPerMm;

    if (pageCount > 0) pdf.addPage();
    pdf.addImage(sliceData, 'JPEG', 0, 0, pageWidthMm, sliceHeightMm);
    pageCount += 1;
  }

  pdf.save(buildFilename(quote));
}

/* ========================= script.js ========================= */

const $ = (id) => document.getElementById(id);

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markSaving() {
  const el = $('autosave-indicator');
  if (!el) return;
  el.textContent = 'Enregistrement…';
  el.className = 'badge badge-muted';
}

function markSaved() {
  const el = $('autosave-indicator');
  if (!el) return;
  el.textContent = 'Enregistré';
  el.className = 'badge badge-gold';
}

let autosaveTimer = null;
function scheduleAutosave(state) {
  markSaving();
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    if (hasAnyContent(state)) {
      saveQuote(state);
      setLastActiveId(state.id);
    }
    markSaved();
  }, 900);
}

function syncTotalsDisplay(state) {
  const t = computeTotals(state);
  const subEl = $('sum-subtotal');
  const totalEl = $('sum-total');
  if (subEl) subEl.textContent = formatCurrency(t.subtotal, state.currency);
  if (totalEl) totalEl.textContent = formatCurrency(t.total, state.currency);
}

function updateLogoPreview(dataUrl) {
  const img = $('logo-preview-img');
  const placeholderIcon = $('logo-placeholder-icon');
  const removeBtn = $('logo-remove');
  if (dataUrl) {
    img.src = dataUrl;
    img.style.display = 'block';
    placeholderIcon.style.display = 'none';
    removeBtn.style.display = 'inline';
  } else {
    img.style.display = 'none';
    img.src = '';
    placeholderIcon.style.display = 'block';
    removeBtn.style.display = 'none';
  }
}

function handleLogoFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Le fichier doit être une image.', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('Le logo dépasse 2 Mo, choisissez un fichier plus léger.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    setLogo(reader.result);
    updateLogoPreview(reader.result);
  };
  reader.onerror = () => showToast("Impossible de lire l'image.", 'error');
  reader.readAsDataURL(file);
}

function renderItemsTable(state) {
  const tbody = $('items-body');
  tbody.innerHTML = '';

  state.items.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="item-desc" value="${escapeAttr(item.description)}" placeholder="Description de la prestation"></td>
      <td class="num"><input type="number" class="qty-input item-qty" value="${item.qty}" min="0" step="1"></td>
      <td class="num"><input type="number" class="price-input item-price" value="${item.unitPrice}" min="0" step="any"></td>
      <td class="num line-total tnum">${formatCurrency(lineTotal(item), state.currency)}</td>
      <td><button type="button" class="row-remove" title="Supprimer la ligne"><i class="icon" data-lucide="trash-2"></i></button></td>
    `;

    const descInput = tr.querySelector('.item-desc');
    const qtyInput = tr.querySelector('.item-qty');
    const priceInput = tr.querySelector('.item-price');
    const totalCell = tr.querySelector('.line-total');
    const removeBtn = tr.querySelector('.row-remove');

    function refreshRowTotal() {
      const qty = parseFloat(qtyInput.value) || 0;
      const price = parseFloat(priceInput.value) || 0;
      totalCell.textContent = formatCurrency(qty * price, getState().currency);
    }

    descInput.addEventListener('input', () => {
      updateItem(item.id, { description: descInput.value });
    });
    qtyInput.addEventListener('input', () => {
      updateItem(item.id, { qty: parseFloat(qtyInput.value) || 0 });
      refreshRowTotal();
    });
    priceInput.addEventListener('input', () => {
      updateItem(item.id, { unitPrice: parseFloat(priceInput.value) || 0 });
      refreshRowTotal();
    });
    removeBtn.addEventListener('click', () => {
      removeItem(item.id);
      renderItemsTable(getState());
    });

    tbody.appendChild(tr);
  });
}

function renderFormFields(state) {
  $('company-name').value = state.company.name || '';
  $('company-address').value = state.company.address || '';
  $('company-phone').value = state.company.phone || '';
  $('company-email').value = state.company.email || '';
  $('company-tax-id').value = state.company.taxId || '';
  updateLogoPreview(state.company.logo);

  $('client-name').value = state.client.name || '';
  $('client-address').value = state.client.address || '';
  $('client-phone').value = state.client.phone || '';
  $('client-email').value = state.client.email || '';

  $('input-currency').value = state.currency;
  $('input-issue-date').value = state.issueDate;
  $('input-validity').value = state.validityDays;
  $('input-number').value = state.number;
  $('input-notes').value = state.notes || '';
  $('input-discount').value = state.discountRate;
  $('input-tax').value = state.taxRate;

  document.querySelectorAll('#design-picker .design-opt').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.design === state.design);
  });

  renderItemsTable(state);
  syncTotalsDisplay(state);
}

function openDrawer() {
  renderHistoryList(getState().id, loadQuoteFromHistory);
  $('drawer-overlay').classList.add('is-open');
  $('history-drawer').classList.add('is-open');
}

function closeDrawer() {
  $('drawer-overlay').classList.remove('is-open');
  $('history-drawer').classList.remove('is-open');
}

function loadQuoteFromHistory(quote) {
  replaceState(JSON.parse(JSON.stringify(quote)));
  renderFormFields(getState());
  setLastActiveId(quote.id);
  markSaved();
  closeDrawer();
  showToast('Devis chargé : ' + quote.number, 'info');
}

function wireText(id, setter) {
  const el = $(id);
  el.addEventListener('input', () => setter(el.value));
}

function wireSignature() {
  const canvas = $('sign-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let drawing = false;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    e.preventDefault();
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a2332';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stop() {
    drawing = false;
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseleave', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stop);

  $('sign-clear').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  $('sign-confirm').addEventListener('click', () => {
    const dataUrl = canvas.toDataURL('image/png');
    const isEmpty = !ctx.getImageData(0, 0, canvas.width, canvas.height).data.some(ch => ch !== 0);
    if (isEmpty) {
      showToast('Veuillez tracer votre signature avant de confirmer.', 'error');
      return;
    }
    setSignature(dataUrl);
    closeSignatureModal();
  });

  function openSignatureModal() {
    $('sign-overlay').classList.add('is-open');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (getState().signature) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = getState().signature;
    }
  }

  function closeSignatureModal() {
    $('sign-overlay').classList.remove('is-open');
  }

  $('btn-sign').addEventListener('click', openSignatureModal);
  $('sign-close').addEventListener('click', closeSignatureModal);
  $('sign-overlay').addEventListener('click', (e) => {
    if (e.target === $('sign-overlay')) closeSignatureModal();
  });
}

function wireStaticInputs() {
  wireText('company-name', (v) => updateCompany({ name: v }));
  wireText('company-address', (v) => updateCompany({ address: v }));
  wireText('company-phone', (v) => updateCompany({ phone: v }));
  wireText('company-email', (v) => updateCompany({ email: v }));
  wireText('company-tax-id', (v) => updateCompany({ taxId: v }));

  wireText('client-name', (v) => updateClient({ name: v }));
  wireText('client-address', (v) => updateClient({ address: v }));
  wireText('client-phone', (v) => updateClient({ phone: v }));
  wireText('client-email', (v) => updateClient({ email: v }));

  $('input-currency').addEventListener('change', (e) => {
    setCurrency(e.target.value);
    renderItemsTable(getState());
  });
  $('input-issue-date').addEventListener('change', (e) => setIssueDate(e.target.value));
  $('input-validity').addEventListener('input', (e) => setValidityDays(parseInt(e.target.value, 10) || 30));
  $('input-notes').addEventListener('input', (e) => setNotes(e.target.value));
  $('input-discount').addEventListener('input', (e) => setDiscountRate(parseFloat(e.target.value) || 0));
  $('input-tax').addEventListener('input', (e) => setTaxRate(parseFloat(e.target.value) || 0));

  $('design-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('.design-opt');
    if (!btn) return;
    setDesign(btn.dataset.design);
    $('design-picker').querySelectorAll('.design-opt').forEach((b) => {
      b.classList.toggle('is-selected', b === btn);
    });
  });

  wireSignature();

  $('btn-add-item').addEventListener('click', () => {
    addItem();
    renderItemsTable(getState());
  });

  $('logo-input').addEventListener('change', (e) => handleLogoFile(e.target.files[0]));
  $('logo-pick').addEventListener('click', () => $('logo-input').click());
  $('logo-remove').addEventListener('click', () => {
    setLogo(null);
    updateLogoPreview(null);
    $('logo-input').value = '';
  });

  $('btn-new').addEventListener('click', () => {
    resetQuote(getNextNumber());
    renderFormFields(getState());
    showToast('Nouveau devis créé', 'success');
  });

  $('btn-save').addEventListener('click', () => {
    const state = getState();
    saveQuote(state);
    setLastActiveId(state.id);
    markSaved();
    showToast('Devis enregistré', 'success');
  });

  $('btn-theme').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    const btn = $('btn-theme');
    const icon = isLight ? 'moon' : 'sun';
    const label = isLight ? 'Clair' : 'Sombre';
    
    btn.innerHTML = `<i class="icon" data-lucide="${icon}"></i><span class="btn-label">${label}</span>`;
    lucide.createIcons();
  });

  $('btn-pdf').addEventListener('click', async () => {
    const btn = $('btn-pdf');
    if (btn.classList.contains('is-loading')) return;
    const state = getState();
    if (!hasAnyContent(state)) {
      showToast('Ajoutez au moins une information avant de générer le PDF.', 'error');
      return;
    }
    btn.classList.add('is-loading');
    btn.disabled = true;
    try {
      await generatePdf(state);
      saveQuote(state);
      setLastActiveId(state.id);
      markSaved();
      showToast('PDF généré avec succès', 'success');
    } catch (err) {
      console.error(err);
      showToast(err && err.message ? err.message : 'Erreur lors de la génération du PDF', 'error');
    } finally {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }
  });

  $('btn-history').addEventListener('click', openDrawer);
  $('drawer-close').addEventListener('click', closeDrawer);
  $('drawer-overlay').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
}

function init() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    const btn = $('btn-theme');
    btn.innerHTML = '<i class="icon" data-lucide="moon"></i><span class="btn-label">Clair</span>';
    lucide.createIcons();
  }

  initPreview();
  subscribe(syncTotalsDisplay);
  subscribe(scheduleAutosave);

  wireStaticInputs();

  let restored = false;
  const lastId = getLastActiveId();
  if (lastId) {
    const found = getQuoteById(lastId);
    if (found) {
      replaceState(JSON.parse(JSON.stringify(found)));
      restored = true;
    }
  }
  if (!restored) {
    resetQuote(getNextNumber());
  }

  renderFormFields(getState());
  markSaved();
}

init();
