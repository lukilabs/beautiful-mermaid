document.getElementById('copy-source-btn').addEventListener('click', function() {
  navigator.clipboard.writeText(editor.value).then(function() { showToast('Source copied!'); });
});

document.getElementById('clear-btn').addEventListener('click', function() {
  editor.value = '';
  updateLineNumbers();
  previewInner.innerHTML = '<div class="preview-placeholder">Start typing to render your diagram</div>';
  statusText.textContent = 'Ready';
  statusText.className = '';
  renderTime.textContent = '';
  window.history.replaceState(null, '', window.location.pathname);
});
