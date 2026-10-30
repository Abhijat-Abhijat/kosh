// Fills repo links from <body data-repo> and draws the decorative line bars.
(function () {
  var repo = document.body.getAttribute('data-repo');
  if (repo) {
    document.querySelectorAll('[data-repo-href]').forEach(function (a) {
      a.href = repo + a.getAttribute('data-repo-href');
    });
  }

  // Deterministic pseudo-random heights so the pattern is stable between visits.
  var seed = 7;
  function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  document.querySelectorAll('.linebars').forEach(function (el) {
    var n = +el.getAttribute('data-count') || 48;
    for (var i = 0; i < n; i++) {
      var r = rand();
      var h = r > 0.94 ? 70 + rand() * 30 : 8 + Math.pow(rand(), 2) * 45;
      var bar = document.createElement('i');
      bar.style.height = h.toFixed(1) + '%';
      bar.style.setProperty('--i', i);
      if (h > 60) bar.className = 'peak';
      el.appendChild(bar);
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { el.classList.add('animate'); io.disconnect(); }
        });
      });
      io.observe(el);
    } else {
      el.classList.add('animate');
    }
  });
})();
