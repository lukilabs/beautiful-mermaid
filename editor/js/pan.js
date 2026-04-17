var panBtn = document.getElementById('pan-btn');
var panActive = false;
var panStart = null;

panBtn.addEventListener('click', function() {
  panActive = !panActive;
  panBtn.classList.toggle('active', panActive);
  previewBody.classList.toggle('pan-mode', panActive);
});

previewBody.addEventListener('mousedown', function(e) {
  var shouldPan = panActive || e.metaKey || e.ctrlKey;
  if (!shouldPan) return;
  if (e.button !== 0) return;
  e.preventDefault();
  panStart = { x: e.clientX, y: e.clientY, sl: previewBody.scrollLeft, st: previewBody.scrollTop };
  previewBody.classList.add('panning');
});

window.addEventListener('mousemove', function(e) {
  if (!panStart) return;
  var dx = e.clientX - panStart.x;
  var dy = e.clientY - panStart.y;
  previewBody.scrollLeft = panStart.sl - dx;
  previewBody.scrollTop  = panStart.st  - dy;
});

window.addEventListener('mouseup', function() {
  if (!panStart) return;
  panStart = null;
  previewBody.classList.remove('panning');
});

window.addEventListener('keydown', function(e) {
  if (e.metaKey || e.ctrlKey) previewBody.classList.add('cmd-pan');
});
window.addEventListener('keyup', function(e) {
  if (!e.metaKey && !e.ctrlKey) previewBody.classList.remove('cmd-pan');
});

previewBody.addEventListener('wheel', function(e) {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  var factor = Math.pow(0.999, e.deltaY);
  applyZoom(state.zoom * factor);
}, { passive: false });
