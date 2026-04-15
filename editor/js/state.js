var SAMPLES = {{SAMPLES_JSON}};
var THEMES = window.__mermaid.THEMES;
var renderMermaid = window.__mermaid.renderMermaidSVGAsync;

var state = {
  theme: '',
  zoom: 1,
  config: {},
  activeCategory: SAMPLES[0]?.category ?? '',
};
