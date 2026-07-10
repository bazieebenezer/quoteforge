// history-manager.js — Persistance locale (localStorage) : historique des devis + numérotation

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

export function getNextNumber() {
  const counter = (readJSON(KEY_COUNTER, 0) || 0) + 1;
  writeJSON(KEY_COUNTER, counter);
  const year = new Date().getFullYear();
  return `DEV-${year}-${String(counter).padStart(4, '0')}`;
}

export function getAllQuotes() {
  const list = readJSON(KEY_HISTORY, []);
  if (!Array.isArray(list)) return [];
  return list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getQuoteById(id) {
  return getAllQuotes().find((q) => q.id === id) || null;
}

export function saveQuote(quote) {
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

export function deleteQuote(id) {
  const list = readJSON(KEY_HISTORY, []);
  const arr = Array.isArray(list) ? list : [];
  const filtered = arr.filter((q) => q.id !== id);
  return writeJSON(KEY_HISTORY, filtered);
}

export function getLastActiveId() {
  return readJSON(KEY_LAST_ACTIVE, null);
}

export function setLastActiveId(id) {
  writeJSON(KEY_LAST_ACTIVE, id);
}

export function hasAnyContent(quote) {
  const c = quote.company;
  const cl = quote.client;
  const hasItems = quote.items.some((it) => it.description.trim() || Number(it.unitPrice) > 0);
  return !!(c.name || c.address || c.phone || c.email || cl.name || cl.address || cl.phone || cl.email || hasItems || (quote.notes && quote.notes.trim()));
}
