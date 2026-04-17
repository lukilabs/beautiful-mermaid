samplesToggle.addEventListener('click', function() {
  var isOpen = samplesBody.classList.toggle('open');
  samplesIcon.classList.toggle('open', isOpen);
});

function renderSampleList(category) {
  state.activeCategory = category;
  document.querySelectorAll('.cat-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.cat === category);
  });
  var items = SAMPLES.filter(function(s) { return s.category === category; });
  sampleList.innerHTML = items.map(function(s, i) {
    return '<div class="sample-item" data-source="' + escAttr(s.source) + '">' +
      '<span class="sample-item-arrow">›</span>' +
      '<span>' + escHtml(s.title) + '</span>' +
      '</div>';
  }).join('');

  sampleList.querySelectorAll('.sample-item').forEach(function(item) {
    item.addEventListener('click', function() {
      editor.value = item.dataset.source;
      updateLineNumbers();
      scheduleRender(0);
    });
  });
}

catTabs.addEventListener('click', function(e) {
  var btn = e.target.closest('.cat-btn');
  if (!btn) return;
  renderSampleList(btn.dataset.cat);
});
