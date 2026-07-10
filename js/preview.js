// preview.js — Construit l'aperçu "papier" en temps réel à partir de l'état du devis

import { subscribe, getState } from './quote.js';
import { computeTotals, formatCurrency, addDays, formatDateFR } from './calculator.js';

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

function renderItemsTable(quote) {
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

export function renderPreview(quote) {
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
    ${renderItemsTable(quote)}
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
}

export function initPreview() {
  renderPreview(getState());
  subscribe(renderPreview);
}
