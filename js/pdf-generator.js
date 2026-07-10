// pdf-generator.js — Transforme l'aperçu "papier" en fichier PDF téléchargeable
//
// Deux pièges classiques sont traités ici :
// 1. html2canvas capture en se basant sur la position de défilement de la
//    fenêtre. Si la page est scrollée au moment du clic, la capture part du
//    mauvais endroit (image décalée, page blanche). On compense via
//    scrollX/scrollY + windowWidth/windowHeight.
// 2. Une pagination "à la règle" (toutes les X px) peut trancher en plein
//    milieu d'une ligne du tableau ou d'un bloc de totaux. On calcule donc
//    les coupures de page entre les blocs DOM (jamais à l'intérieur).

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

// Éléments qui ne doivent jamais être coupés par un saut de page.
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

// Calcule les positions (en px de canvas) où il est sûr de couper la page :
// jamais à l'intérieur d'un segment, uniquement entre deux segments.
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
    if (seg.bottom - pageStart <= pageHeightPx) continue; // tient sur la page en cours

    const segHeight = seg.bottom - seg.top;

    if (segHeight <= pageHeightPx && seg.top > pageStart) {
      // On commence une nouvelle page juste avant ce segment.
      breaks.push(seg.top);
      pageStart = seg.top;
    } else if (segHeight > pageHeightPx) {
      // Cas rare : le segment seul dépasse une page entière (ex. très longue
      // description). On retombe sur une coupe brute, faute de mieux.
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

export async function generatePdf(quote) {
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
    // Compense la position de défilement de la page au moment de la capture.
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
      // Filet de sécurité si la structure attendue n'est pas trouvée.
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
