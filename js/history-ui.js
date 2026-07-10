// history-ui.js — Rendu du tiroir "Historique" : liste, chargement, suppression confirmée

import { getAllQuotes, deleteQuote } from './history-manager.js';
import { computeTotals, formatCurrency } from './calculator.js';
import { showToast } from './toast.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

export function renderHistoryList(activeId, onLoad) {
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
