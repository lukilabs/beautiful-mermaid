document.querySelectorAll('.tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    var panel = tab.dataset.panel;
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    if (panel === 'code') {
      editorView.style.display = 'flex';
      configView.classList.remove('visible');
      document.getElementById('editor-panel-title').textContent = 'Source';
    } else {
      editorView.style.display = 'none';
      configView.classList.add('visible');
      document.getElementById('editor-panel-title').textContent = 'Config';
      refreshAllColorUIs();
    }
  });
});
