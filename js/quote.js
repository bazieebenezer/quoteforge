// quote.js — État du devis en cours + petit système d'abonnement (pub/sub)

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

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export function replaceState(newState) {
  state = newState;
  notify();
}

export function resetQuote(number) {
  state = emptyQuote(number);
  notify();
}

export function updateCompany(partial) {
  Object.assign(state.company, partial);
  notify();
}

export function updateClient(partial) {
  Object.assign(state.client, partial);
  notify();
}

export function setLogo(dataUrl) {
  state.company.logo = dataUrl;
  notify();
}

export function addItem() {
  state.items.push({ id: makeItemId(), description: '', qty: 1, unitPrice: 0 });
  notify();
}

export function removeItem(itemId) {
  state.items = state.items.filter((it) => it.id !== itemId);
  if (state.items.length === 0) {
    state.items.push({ id: makeItemId(), description: '', qty: 1, unitPrice: 0 });
  }
  notify();
}

export function updateItem(itemId, partial) {
  const item = state.items.find((it) => it.id === itemId);
  if (!item) return;
  Object.assign(item, partial);
  notify();
}

export function setCurrency(currency) {
  state.currency = currency;
  notify();
}

export function setTaxRate(rate) {
  state.taxRate = Number.isFinite(rate) ? rate : 0;
  notify();
}

export function setDiscountRate(rate) {
  state.discountRate = Number.isFinite(rate) ? rate : 0;
  notify();
}

export function setIssueDate(dateStr) {
  state.issueDate = dateStr;
  notify();
}

export function setValidityDays(days) {
  state.validityDays = Number.isFinite(days) ? days : 30;
  notify();
}

export function setNotes(text) {
  state.notes = text;
  notify();
}

export function setNumber(number) {
  state.number = number;
  notify();
}

export function setDesign(name) {
  state.design = name;
  notify();
}

export function setSignature(dataUrl) {
  state.signature = dataUrl;
  state.signatureDate = dataUrl ? new Date().toISOString() : null;
  notify();
}

export function cloneState() {
  return JSON.parse(JSON.stringify(state));
}
