// script.js — Point d'entrée : orchestre les modules et les événements du DOM

import {
  getState, subscribe, replaceState, resetQuote,
  updateCompany, updateClient, setLogo,
  addItem, removeItem, updateItem,
  setCurrency, setTaxRate, setDiscountRate, setDesign, setSignature,
  setIssueDate, setValidityDays, setNotes
} from './quote.js';

import { computeTotals, formatCurrency, lineTotal } from './calculator.js';
import { initPreview } from './preview.js';
import {
  getNextNumber, saveQuote, getQuoteById,
  getLastActiveId, setLastActiveId, hasAnyContent
} from './history-manager.js';
import { renderHistoryList } from './history-ui.js';
import { generatePdf } from './pdf-generator.js';
import { showToast } from './toast.js';

const $ = (id) => document.getElementById(id);

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ---------------------------------------------------------------------
   Indicateur d'enregistrement + sauvegarde automatique
   --------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------
   Logo
   --------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------
   Tableau des prestations
   --------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------
   Rendu complet du formulaire (chargement initial / historique / nouveau)
   --------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------
   Tiroir Historique
   --------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------
   Câblage des champs statiques (exécuté une seule fois)
   --------------------------------------------------------------------- */

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
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isEmpty = !imageData.data.some(ch => ch !== 0);
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

  // Logo
  $('logo-input').addEventListener('change', (e) => handleLogoFile(e.target.files[0]));
  $('logo-pick').addEventListener('click', () => $('logo-input').click());
  $('logo-remove').addEventListener('click', () => {
    setLogo(null);
    updateLogoPreview(null);
    $('logo-input').value = '';
  });

  // Nouveau devis
  $('btn-new').addEventListener('click', () => {
    resetQuote(getNextNumber());
    renderFormFields(getState());
    showToast('Nouveau devis créé', 'success');
  });

  // Enregistrer (explicite, immédiat)
  $('btn-save').addEventListener('click', () => {
    const state = getState();
    saveQuote(state);
    setLastActiveId(state.id);
    markSaved();
    showToast('Devis enregistré', 'success');
  });

  // Theme toggle
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

  // Générer le PDF
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

  // Historique
  $('btn-history').addEventListener('click', openDrawer);
  $('drawer-close').addEventListener('click', closeDrawer);
  $('drawer-overlay').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
}

/* ---------------------------------------------------------------------
   Initialisation
   --------------------------------------------------------------------- */

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
