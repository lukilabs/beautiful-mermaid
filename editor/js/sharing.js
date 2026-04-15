function encodeSource(src) {
  try { return btoa(unescape(encodeURIComponent(src))); } catch(e) { return ''; }
}
function decodeSource(b64) {
  try { return decodeURIComponent(escape(atob(b64))); } catch(e) { return ''; }
}

function getHashSource() {
  var hash = window.location.hash.slice(1);
  if (!hash) return null;
  try {
    var obj = JSON.parse(decodeSource(hash));
    if (obj && obj.source) {
      if (obj.theme) { themeSelect.value = obj.theme; state.theme = obj.theme; }
      return obj.source;
    }
  } catch(e) {}
  return decodeSource(hash) || null;
}

function updateHash() {
  var obj = { source: editor.value };
  if (state.theme) obj.theme = state.theme;
  window.history.replaceState(null, '', '#' + encodeSource(JSON.stringify(obj)));
}
