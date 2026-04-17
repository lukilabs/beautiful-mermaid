var savedTheme = localStorage.getItem('bm-editor-theme') || '';
if (savedTheme) {
  themeSelect.value = savedTheme;
  state.theme = savedTheme;
  diagramThemeIsAuto = false;
}

themeSelect.addEventListener('change', function() {
  state.theme = themeSelect.value;
  if (themeSelect.value) {
    localStorage.setItem('bm-editor-theme', themeSelect.value);
  } else {
    localStorage.removeItem('bm-editor-theme');
  }
  refreshAllColorUIs();
  scheduleRender(0);
});

renderSampleList(state.activeCategory);

var hashSource = getHashSource();
if (hashSource) {
  editor.value = hashSource;
} else {
  editor.value = SAMPLES[0].source;
}

updateLineNumbers();
scheduleRender(0);
