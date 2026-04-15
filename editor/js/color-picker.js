var colorPopup    = document.getElementById('color-popup');
var colorNative   = document.getElementById('color-native-input');
var colorHexInput = document.getElementById('color-hex-input');
var activeColorKey = null;

var paletteEl = document.getElementById('color-palette');
COLOR_PRESETS.forEach(function(hex) {
  var btn = document.createElement('button');
  btn.className = 'color-swatch-btn';
  btn.style.background = hex;
  btn.title = hex;
  btn.addEventListener('click', function() {
    setActiveColor(hex);
  });
  paletteEl.appendChild(btn);
});

function openColorPopup(key, anchorEl) {
  activeColorKey = key;
  var labels = { bg:'Background', fg:'Foreground', accent:'Accent', line:'Line', muted:'Muted', surface:'Surface' };
  document.getElementById('color-popup-title').textContent = labels[key] || key;

  var val = cfgColors[key] || '#ffffff';
  colorHexInput.value = cfgColors[key] || '';
  if (/^#[0-9a-fA-F]{6}$/.test(val)) colorNative.value = val;

  var rect = anchorEl.getBoundingClientRect();
  var popup = colorPopup;
  popup.classList.add('open');
  var pw = 240;
  var left = rect.right - pw;
  if (left < 8) left = 8;
  var top = rect.bottom + 6;
  if (top + 400 > window.innerHeight) top = rect.top - 406;
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';
}

function setActiveColor(hex) {
  if (!activeColorKey) return;
  cfgColors[activeColorKey] = hex;
  colorHexInput.value = hex;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) colorNative.value = hex;
  updateColorUI(activeColorKey);
  readConfig();
  scheduleRender(200);
}

function closeColorPopup() {
  colorPopup.classList.remove('open');
  activeColorKey = null;
}

document.querySelectorAll('.color-edit-btn').forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var key = btn.dataset.cfg;
    if (colorPopup.classList.contains('open') && activeColorKey === key) {
      closeColorPopup(); return;
    }
    openColorPopup(key, btn);
  });
});

document.getElementById('color-popup-close').addEventListener('click', closeColorPopup);

document.getElementById('color-clear-btn').addEventListener('click', function() {
  if (!activeColorKey) return;
  cfgColors[activeColorKey] = '';
  colorHexInput.value = '';
  updateColorUI(activeColorKey);
  readConfig();
  scheduleRender(200);
});

colorNative.addEventListener('input', function() {
  setActiveColor(colorNative.value);
});

colorHexInput.addEventListener('input', function() {
  var val = colorHexInput.value.trim();
  if (!val.startsWith('#')) val = '#' + val;
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    colorNative.value = val;
    cfgColors[activeColorKey] = val;
    updateColorUI(activeColorKey);
    readConfig();
    scheduleRender(400);
  }
});

document.addEventListener('click', function(e) {
  if (!colorPopup.classList.contains('open')) return;
  if (!e.target.closest('#color-popup') && !e.target.closest('.color-edit-btn')) closeColorPopup();
});
