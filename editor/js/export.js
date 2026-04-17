var exportScale = 4;
var exportDropdown = document.getElementById('export-dropdown');

function toggleExportDropdown(e) {
  e.stopPropagation();
  exportDropdown.classList.toggle('open');
}
document.getElementById('export-chevron-btn').addEventListener('click', toggleExportDropdown);
document.getElementById('export-main-btn').addEventListener('click', function() {
  exportPNG();
});

document.addEventListener('click', function(e) {
  if (!e.target.closest('#export-wrap')) exportDropdown.classList.remove('open');
});

document.getElementById('size-pills').addEventListener('click', function(e) {
  var pill = e.target.closest('.size-pill');
  if (!pill) return;
  exportScale = parseInt(pill.dataset.scale, 10);
  document.querySelectorAll('.size-pill').forEach(function(p) { p.classList.remove('active'); });
  pill.classList.add('active');
});

function getSvgEl() {
  var el = previewInner.querySelector('svg');
  if (!el) { showToast('Render a diagram first.'); return null; }
  return el;
}

function svgToPngBlob(svgEl, scale, cb) {
  var serialized = new XMLSerializer().serializeToString(svgEl);
  var svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  var url = URL.createObjectURL(svgBlob);
  var img = new Image();
  img.onload = function() {
    var canvas = document.createElement('canvas');
    var w = img.naturalWidth  || svgEl.viewBox.baseVal.width  || 800;
    var h = img.naturalHeight || svgEl.viewBox.baseVal.height || 600;
    canvas.width  = w * scale;
    canvas.height = h * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(cb, 'image/png');
  };
  img.onerror = function() { URL.revokeObjectURL(url); showToast('PNG export failed.'); };
  img.src = url;
}

function exportPNG() {
  var svgEl = getSvgEl(); if (!svgEl) return;
  svgToPngBlob(svgEl, exportScale, function(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'diagram.png'; a.click();
    URL.revokeObjectURL(url);
    showToast('PNG saved (' + exportScale + 'x)');
    exportDropdown.classList.remove('open');
  });
}

function exportSVG() {
  var svgEl = getSvgEl(); if (!svgEl) return;
  var data = new XMLSerializer().serializeToString(svgEl);
  var blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'diagram.svg'; a.click();
  URL.revokeObjectURL(url);
  showToast('SVG saved!');
  exportDropdown.classList.remove('open');
}

function copyImage() {
  var svgEl = getSvgEl(); if (!svgEl) return;
  svgToPngBlob(svgEl, exportScale, function(blob) {
    try {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function() {
        showToast('Image copied to clipboard!');
        exportDropdown.classList.remove('open');
      });
    } catch(e) { showToast('Copy not supported in this browser.'); }
  });
}

function copyURL() {
  updateHash();
  navigator.clipboard.writeText(window.location.href).then(function() {
    showToast('URL copied to clipboard!');
    exportDropdown.classList.remove('open');
  });
}

document.getElementById('export-png-btn').addEventListener('click', exportPNG);
document.getElementById('export-svg-btn').addEventListener('click', exportSVG);
document.getElementById('copy-image-btn').addEventListener('click', copyImage);
document.getElementById('copy-link-btn').addEventListener('click', copyURL);

document.addEventListener('keydown', function(e) {
  if (e.target === editor) return;
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 's') { e.preventDefault(); exportPNG(); }
  if ((e.metaKey || e.ctrlKey) &&  e.shiftKey && e.key === 'S') { e.preventDefault(); exportSVG(); }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'c') { e.preventDefault(); copyImage(); }
  if ((e.metaKey || e.ctrlKey) &&  e.shiftKey && e.key === 'C') { e.preventDefault(); copyURL(); }
});
