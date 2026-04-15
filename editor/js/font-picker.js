var PRESET_FONTS = [
  { name: 'Inter',           value: 'Inter',           group: 'Sans-serif' },
  { name: 'Geist',           value: 'Geist',           group: 'Sans-serif' },
  { name: 'Roboto',          value: 'Roboto',          group: 'Sans-serif' },
  { name: 'Open Sans',       value: 'Open Sans',       group: 'Sans-serif' },
  { name: 'Lato',            value: 'Lato',            group: 'Sans-serif' },
  { name: 'Poppins',         value: 'Poppins',         group: 'Sans-serif' },
  { name: 'Nunito',          value: 'Nunito',          group: 'Sans-serif' },
  { name: 'DM Sans',         value: 'DM Sans',         group: 'Sans-serif' },
  { name: 'Space Grotesk',   value: 'Space Grotesk',   group: 'Sans-serif' },
  { name: 'Arial',           value: 'Arial',           group: 'System' },
  { name: 'Georgia',         value: 'Georgia',         group: 'Serif' },
  { name: 'Merriweather',    value: 'Merriweather',    group: 'Serif' },
  { name: 'Playfair Display',value: 'Playfair Display',group: 'Serif' },
  { name: 'JetBrains Mono',  value: 'JetBrains Mono',  group: 'Monospace' },
  { name: 'Fira Code',       value: 'Fira Code',       group: 'Monospace' },
  { name: 'Source Code Pro', value: 'Source Code Pro', group: 'Monospace' },
  { name: 'Courier New',     value: 'Courier New',     group: 'Monospace' },
];

var fontPopup     = document.getElementById('font-popup');
var fontSearch    = document.getElementById('font-search');
var fontList      = document.getElementById('font-list');
var fontSelectBtn = document.getElementById('font-select-btn');
var fontSelectLabel = document.getElementById('font-select-label');

function buildFontList(query) {
  var q = (query || '').toLowerCase();
  var filtered = PRESET_FONTS.filter(function(f) {
    return !q || f.name.toLowerCase().includes(q) || f.value.toLowerCase().includes(q);
  });

  var groups = {};
  filtered.forEach(function(f) {
    if (!groups[f.group]) groups[f.group] = [];
    groups[f.group].push(f);
  });

  fontList.innerHTML = '';

  var browserFonts = [];
  try {
    document.fonts.forEach(function(ff) {
      var n = ff.family.replace(/['"]/g, '');
      if (!q || n.toLowerCase().includes(q)) browserFonts.push(n);
    });
    browserFonts = [...new Set(browserFonts)].sort();
  } catch(e) {}

  Object.keys(groups).forEach(function(group) {
    var label = document.createElement('div');
    label.className = 'font-section-label';
    label.textContent = group;
    fontList.appendChild(label);
    groups[group].forEach(function(f) { appendFontItem(f.name, f.value); });
  });

  if (browserFonts.length) {
    var label = document.createElement('div');
    label.className = 'font-section-label';
    label.textContent = 'Loaded in browser';
    fontList.appendChild(label);
    browserFonts.forEach(function(name) {
      appendFontItem(name, name);
    });
  }
}

function appendFontItem(name, value) {
  var item = document.createElement('div');
  item.className = 'font-item' + (cfgFont === value ? ' active' : '');
  var previewSpan = document.createElement('span');
  previewSpan.className = 'font-item-preview';
  previewSpan.style.fontFamily = value + ', sans-serif';
  previewSpan.textContent = 'Aa';
  var nameSpan = document.createElement('span');
  nameSpan.className = 'font-item-name';
  nameSpan.textContent = name;
  item.appendChild(previewSpan);
  item.appendChild(nameSpan);
  item.addEventListener('click', function() {
    cfgFont = value;
    fontSelectLabel.textContent = name;
    closeFontPopup();
    readConfig();
    scheduleRender(0);
  });
  fontList.appendChild(item);
}

function openFontPopup() {
  buildFontList('');
  fontSearch.value = '';
  var rect = fontSelectBtn.getBoundingClientRect();
  var top = rect.bottom + 6;
  var left = rect.right - 220;
  if (left < 8) left = 8;
  fontPopup.style.top  = top  + 'px';
  fontPopup.style.left = left + 'px';
  fontPopup.classList.add('open');
  fontSearch.focus();
}

function closeFontPopup() {
  fontPopup.classList.remove('open');
}

fontSelectBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  if (fontPopup.classList.contains('open')) { closeFontPopup(); return; }
  openFontPopup();
});

fontSearch.addEventListener('input', function() {
  buildFontList(fontSearch.value);
});

document.addEventListener('click', function(e) {
  if (!fontPopup.classList.contains('open')) return;
  if (!e.target.closest('#font-popup') && !e.target.closest('#font-select-btn')) closeFontPopup();
});

var paddingNum    = document.getElementById('cfg-padding');
var paddingSlider = document.getElementById('cfg-padding-slider');

function setPadding(val) {
  val = Math.max(0, Math.min(120, parseInt(val, 10) || 0));
  cfgPadding = val;
  paddingNum.value    = val;
  paddingSlider.value = val;
  readConfig();
  scheduleRender(200);
}

paddingNum.addEventListener('input', function() { setPadding(paddingNum.value); });
paddingSlider.addEventListener('input', function() { setPadding(paddingSlider.value); });
