// toast.js — Système de notifications (succès / erreur / info)

const ICONS = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'info'
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function showToast(message, type = 'info', duration = 3500) {
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
