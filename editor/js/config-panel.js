var cfgColors = { bg: '', fg: '', accent: '', line: '', muted: '', surface: '' };
var cfgFont = '';
var cfgPadding = 24;

var COLOR_PRESETS = [
  '#ffffff','#f5f5f5','#e0e0e0','#bdbdbd','#9e9e9e','#757575','#424242','#212121','#000000',
  '#f44336','#e91e63','#ff4081','#ff1744','#d50000',
  '#9c27b0','#673ab7','#3f51b5','#7c4dff','#aa00ff',
  '#2196f3','#03a9f4','#00bcd4','#1565c0','#2979ff','#0091ea',
  '#4caf50','#8bc34a','#009688','#00e676','#1b5e20',
  '#ffeb3b','#ffc107','#ff9800','#ff5722','#ff6d00',
  '#0f1117','#161b22','#1c2128','#0d1117','#1a1a2e','#16213e',
];

function readConfig() {
  var cfg = {};
  if (cfgColors.bg)      cfg.bg      = cfgColors.bg;
  if (cfgColors.fg)      cfg.fg      = cfgColors.fg;
  if (cfgColors.accent)  cfg.accent  = cfgColors.accent;
  if (cfgColors.line)    cfg.line    = cfgColors.line;
  if (cfgColors.muted)   cfg.muted   = cfgColors.muted;
  if (cfgColors.surface) cfg.surface = cfgColors.surface;
  if (cfgFont)           cfg.font    = cfgFont;
  if (cfgPadding !== 24) cfg.padding = cfgPadding;
  state.config = cfg;
}

var THEME_COLOR_MAP = { bg: 'bg', fg: 'fg', accent: 'accent', line: 'line', muted: 'muted', surface: 'surface' };

function getThemeColor(key) {
  if (!state.theme || !THEMES[state.theme]) return null;
  return THEMES[state.theme][THEME_COLOR_MAP[key]] || null;
}

function updateColorUI(key) {
  var override = cfgColors[key];
  var themeVal = getThemeColor(key);
  var effective = override || themeVal;
  var label  = document.getElementById('cfg-' + key + '-label');
  var swatch = document.getElementById('cfg-' + key + '-swatch');
  var btn    = document.querySelector('.color-edit-btn[data-cfg="' + key + '"]');

  if (label) {
    label.textContent = override || (themeVal ? themeVal : '—');
    label.style.opacity = override ? '1' : '0.45';
  }
  if (swatch) {
    swatch.style.background = effective || 'transparent';
    swatch.style.border = effective ? '1px solid rgba(0,0,0,0.15)' : '1px dashed var(--fg3)';
    swatch.style.opacity = override ? '1' : (themeVal ? '0.6' : '1');
  }
  if (btn) {
    btn.title = override ? 'Override: ' + override : (themeVal ? 'Theme default: ' + themeVal : 'Not set');
  }
}

function refreshAllColorUIs() {
  Object.keys(cfgColors).forEach(function(k) { updateColorUI(k); });
}

refreshAllColorUIs();

var cfgEdgeStroke = 1;
var cfgNodeStroke = 1;

function applyStrokeOverrides(svgEl) {
  if (!svgEl) return;
  var defsEl = svgEl.querySelector('defs');

  function inDefs(el) {
    return defsEl && defsEl.contains(el);
  }

  if (cfgEdgeStroke !== 1) {
    var ew = String(cfgEdgeStroke);
    svgEl.querySelectorAll('line, path[fill="none"], polyline[fill="none"]').forEach(function(el) {
      if (!inDefs(el)) el.setAttribute('stroke-width', ew);
    });
    var arrowFactor = Math.sqrt(cfgEdgeStroke);
    svgEl.querySelectorAll('defs marker').forEach(function(marker) {
      var origW = parseFloat(marker.getAttribute('markerWidth')  || '8');
      var origH = parseFloat(marker.getAttribute('markerHeight') || '5');
      marker.setAttribute('viewBox', '0 0 ' + origW + ' ' + origH);
      marker.setAttribute('markerUnits', 'userSpaceOnUse');
      marker.setAttribute('markerWidth',  String(origW * arrowFactor));
      marker.setAttribute('markerHeight', String(origH * arrowFactor));
    });
  }

  if (cfgNodeStroke !== 1) {
    var nw = String(cfgNodeStroke);
    svgEl.querySelectorAll('rect, ellipse, circle, polygon').forEach(function(el) {
      if (!inDefs(el)) el.setAttribute('stroke-width', nw);
    });
  }
}

function makeStrokeSetter(numEl, sliderEl, getVal, setVal) {
  return function(raw) {
    var v = Math.max(0.25, Math.min(6, parseFloat(raw) || 1));
    v = Math.round(v * 4) / 4;
    setVal(v);
    numEl.value    = v;
    sliderEl.value = v;
    var svgEl = previewInner.querySelector('svg');
    if (svgEl) applyStrokeOverrides(svgEl);
  };
}

var edgeStrokeNum    = document.getElementById('cfg-edge-stroke');
var edgeStrokeSlider = document.getElementById('cfg-edge-stroke-slider');
var nodeStrokeNum    = document.getElementById('cfg-node-stroke');
var nodeStrokeSlider = document.getElementById('cfg-node-stroke-slider');

var setEdgeStroke = makeStrokeSetter(edgeStrokeNum, edgeStrokeSlider,
  function() { return cfgEdgeStroke; },
  function(v) { cfgEdgeStroke = v; }
);
var setNodeStroke = makeStrokeSetter(nodeStrokeNum, nodeStrokeSlider,
  function() { return cfgNodeStroke; },
  function(v) { cfgNodeStroke = v; }
);

edgeStrokeNum.addEventListener('input',    function() { setEdgeStroke(edgeStrokeNum.value); });
edgeStrokeSlider.addEventListener('input', function() { setEdgeStroke(edgeStrokeSlider.value); });
nodeStrokeNum.addEventListener('input',    function() { setNodeStroke(nodeStrokeNum.value); });
nodeStrokeSlider.addEventListener('input', function() { setNodeStroke(nodeStrokeSlider.value); });
