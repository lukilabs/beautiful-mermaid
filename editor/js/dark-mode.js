var isDark = localStorage.getItem('bm-editor-dark') !== 'false';
var iconMoon = document.getElementById('icon-moon');
var iconSun  = document.getElementById('icon-sun');

var AUTO_DARK_DIAGRAM_THEME  = 'zinc-dark';
var AUTO_LIGHT_DIAGRAM_THEME = '';

var diagramThemeIsAuto = true;

function applyColorMode(dark, force) {
  isDark = dark;
  if (dark) {
    document.documentElement.classList.remove('light');
    iconMoon.style.display = '';
    iconSun.style.display  = 'none';
  } else {
    document.documentElement.classList.add('light');
    iconMoon.style.display = 'none';
    iconSun.style.display  = '';
  }
  localStorage.setItem('bm-editor-dark', dark ? 'true' : 'false');

  if (diagramThemeIsAuto || force) {
    var autoTheme = dark ? AUTO_DARK_DIAGRAM_THEME : AUTO_LIGHT_DIAGRAM_THEME;
    themeSelect.value = autoTheme;
    state.theme = autoTheme;
    diagramThemeIsAuto = true;
    refreshAllColorUIs();
    scheduleRender(0);
  }
}

document.getElementById('dark-light-btn').addEventListener('click', function() {
  applyColorMode(!isDark, true);
});

themeSelect.addEventListener('change', function() {
  diagramThemeIsAuto = false;
}, { capture: true });

applyColorMode(isDark);
