var renderTimer = null;

function scheduleRender(delay) {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(doRender, delay ?? 300);
}

function buildOptions() {
  var opts = {};
  if (state.theme && THEMES[state.theme]) {
    var t = THEMES[state.theme];
    opts.bg = t.bg;
    opts.fg = t.fg;
    if (t.line)    opts.line    = t.line;
    if (t.accent)  opts.accent  = t.accent;
    if (t.muted)   opts.muted   = t.muted;
    if (t.surface) opts.surface = t.surface;
    if (t.border)  opts.border  = t.border;
  }
  return Object.assign(opts, state.config);
}

async function doRender() {
  var source = editor.value.trim();
  if (!source) {
    previewInner.innerHTML = '<div class="preview-placeholder">Start typing to render your diagram</div>';
    statusText.textContent = 'Ready';
    statusText.className = '';
    renderTime.textContent = '';
    return;
  }

  spinner.classList.add('visible');
  var t0 = performance.now();

  try {
    var svg = await renderMermaid(source, buildOptions());
    var ms = (performance.now() - t0).toFixed(0);
    previewInner.innerHTML = svg;
    var svgEl = previewInner.querySelector('svg');
    applyStrokeOverrides(svgEl);
    applyZoom(state.zoom);
    statusText.textContent = 'OK';
    statusText.className = 'status-ok';
    renderTime.textContent = 'Rendered in ' + ms + 'ms';
    updateHash();
  } catch(err) {
    var ms = (performance.now() - t0).toFixed(0);
    previewInner.innerHTML = '<div class="preview-error">' + escHtml(String(err)) + '</div>';
    statusText.textContent = 'Error';
    statusText.className = 'status-err';
    renderTime.textContent = '';
  } finally {
    spinner.classList.remove('visible');
  }
}
