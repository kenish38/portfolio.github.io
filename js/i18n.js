// ===== Troca de idioma (EN / PT-BR) =====
// O HTML já vem em inglês. Cada elemento traduzível guarda o português em
// data-pt (e data-pt-alt, data-pt-aria-label, data-pt-href e data-pt-content para atributos).
// Este arquivo roda no fim da página, antes de ela aparecer, para quem volta
// em PT-BR não ver o inglês piscar.
(function () {
  var KEY = 'site-lang';
  var ATTRS = [['alt', 'ptAlt', 'enAlt'], ['aria-label', 'ptAriaLabel', 'enAriaLabel'], ['href', 'ptHref', 'enHref'], ['content', 'ptContent', 'enContent']];
  var buttons = document.querySelectorAll('.lang button');

  function apply(lang) {
    var pt = lang === 'pt';
    document.documentElement.lang = pt ? 'pt-BR' : 'en';
    document.querySelectorAll('[data-pt]').forEach(function (el) {
      if (el.dataset.en === undefined) el.dataset.en = el.textContent;
      el.textContent = pt ? el.dataset.pt : el.dataset.en;
    });
    ATTRS.forEach(function (a) {
      document.querySelectorAll('[data-pt-' + a[0] + ']').forEach(function (el) {
        if (el.dataset[a[2]] === undefined) el.dataset[a[2]] = el.getAttribute(a[0]);
        el.setAttribute(a[0], pt ? el.dataset[a[1]] : el.dataset[a[2]]);
      });
    });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      apply(b.dataset.lang);
      try { localStorage.setItem(KEY, b.dataset.lang); } catch (e) {}
    });
  });

  // Um link pode pedir o idioma: .../?lang=pt abre em português, .../?lang=en em inglês (para mandar a um cliente).
  // Depois vem a escolha salva; sem escolha, segue o idioma do navegador.
  var saved = null, asked = /[?&]lang=(pt|en)\b/i.exec(location.search);
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (asked) saved = asked[1].toLowerCase();
  var browserPt = /^pt\b/i.test(navigator.language || '');
  if (saved === 'pt' || (!saved && browserPt)) apply('pt');
})();
