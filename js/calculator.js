// calculator.js — Logique de calcul (sous-total, remise, TVA, total) + formatage monétaire

export function lineTotal(item) {
  const qty = Number(item.qty) || 0;
  const price = Number(item.unitPrice) || 0;
  return qty * price;
}

export function subtotal(items) {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

export function discountAmount(subtotalValue, discountRate) {
  const rate = Number(discountRate) || 0;
  return subtotalValue * (rate / 100);
}

export function taxAmount(baseValue, taxRate) {
  const rate = Number(taxRate) || 0;
  return baseValue * (rate / 100);
}

export function computeTotals(quote) {
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

export function formatCurrency(amount, currency) {
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

export function formatNumber(amount) {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
}

export function addDays(isoDateStr, days) {
  const base = isoDateStr ? new Date(isoDateStr) : new Date();
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + (Number(days) || 0));
  const pad = (n) => String(n).padStart(2, '0');
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

export function formatDateFR(isoDateStr) {
  if (!isoDateStr) return '—';
  const d = new Date(isoDateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
}
