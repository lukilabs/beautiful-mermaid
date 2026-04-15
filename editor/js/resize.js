var isResizing = false;
var resizeStartX = 0;
var resizeStartW = 0;

resizeHandle.addEventListener('mousedown', function(e) {
  isResizing = true;
  resizeStartX = e.clientX;
  resizeStartW = panelLeft.getBoundingClientRect().width;
  resizeHandle.classList.add('dragging');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', function(e) {
  if (!isResizing) return;
  var dx = e.clientX - resizeStartX;
  var newW = Math.max(280, Math.min(window.innerWidth * 0.75, resizeStartW + dx));
  panelLeft.style.width = newW + 'px';
});

document.addEventListener('mouseup', function() {
  if (!isResizing) return;
  isResizing = false;
  resizeHandle.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});
