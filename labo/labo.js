// Banc d'essai PWA iOS, partagé par a.html, b.html et c.html.
// Script classique : aucune dépendance, aucun module.
(function () {
  'use strict'

  var COLORS = {
    light: { bg: '#F3F4F1', veil: '#15171A', veilAlpha: 0.35 },
    dark: { bg: '#0F1112', veil: '#0F1112', veilAlpha: 0.7 },
  }

  // Courbe de ressort échantillonnée : raideur 400, amortissement 30, masse 1
  // (amortissement relatif 0,75), dépassement d'environ 3 %, 390 ms.
  var SPRING_CURVE = 'linear(0, 0.039, 0.132, 0.255, 0.386, 0.514, 0.631, 0.732, 0.815, 0.882, ' +
    '0.933, 0.97, 0.996, 1.013, 1.023, 1.027, 1.028, 1.027, 1.024, 1.021, 1.017, 1.013, 1.01, ' +
    '1.007, 1.005, 1.003, 1)'
  var SPRING_MS = 390

  var root = document.documentElement
  var params = new URLSearchParams(window.location.search)

  // Réglages lus depuis l'URL, pour survivre au rechargement.
  var state = {
    theme: params.get('theme') === 'dark' ? 'dark' : 'light',
    scroll: params.get('scroll') === '1',
    noBounce: params.get('bounce') === '0',
    sync: params.get('sync') === '1',
    touch: params.get('touch') === '1',
  }

  // Écouteur passif sur document, posé dès le chargement si demandé.
  if (state.touch) {
    document.addEventListener('touchstart', function () {}, { passive: true })
  }

  var themeMeta = document.querySelector('meta[name="theme-color"]')

  var hexToRgb = function (hex) {
    var n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }

  var rgbToHex = function (rgb) {
    return '#' + rgb.map(function (c) {
      var s = Math.round(c).toString(16)
      return s.length === 1 ? '0' + s : s
    }).join('').toUpperCase()
  }

  // Couleur pleine du voile posé sur bg.
  var veilOnBg = function (theme) {
    var c = COLORS[theme]
    var fg = hexToRgb(c.veil)
    var bg = hexToRgb(c.bg)
    return rgbToHex(fg.map(function (v, i) {
      return v * c.veilAlpha + bg[i] * (1 - c.veilAlpha)
    }))
  }

  var setChrome = function (color) {
    themeMeta.setAttribute('content', color)
    document.body.style.backgroundColor = color
  }

  var writeUrl = function () {
    var p = new URLSearchParams()
    if (state.theme === 'dark') p.set('theme', 'dark')
    if (state.scroll) p.set('scroll', '1')
    if (state.noBounce) p.set('bounce', '0')
    if (state.sync) p.set('sync', '1')
    if (state.touch) p.set('touch', '1')
    var q = p.toString()
    return window.location.pathname + (q ? '?' + q : '')
  }

  var label = root.getAttribute('data-labo') || '?'

  var fillerHtml = function () {
    var out = ''
    for (var i = 1; i <= 3; i++) {
      out += '<div class="filler-block">Écran ' + i + ' sur 3</div>'
    }
    return out
  }

  document.body.innerHTML =
    '<div class="root" id="root">' +
      '<div class="scroller" id="scroller">' +
        '<h1>Labo ' + label + '</h1>' +
        '<section class="card">' +
          '<dl class="measures">' +
            '<div><dt>Safe-area haut</dt><dd id="m-top"></dd></div>' +
            '<div><dt>Safe-area bas</dt><dd id="m-bottom"></dd></div>' +
            '<div><dt>innerHeight</dt><dd id="m-inner"></dd></div>' +
            '<div><dt>100dvh</dt><dd id="m-dvh"></dd></div>' +
            '<div><dt>Standalone</dt><dd id="m-standalone"></dd></div>' +
            '<div><dt>linear()</dt><dd id="m-linear"></dd></div>' +
            '<div class="wide"><dt>overscroll-behavior</dt><dd id="m-overscroll"></dd></div>' +
          '</dl>' +
          '<p class="ua" id="m-ua"></p>' +
        '</section>' +
        '<section class="card">' +
          '<div class="row">' +
            '<button type="button" data-set="theme" data-value="light">Clair</button>' +
            '<button type="button" data-set="theme" data-value="dark">Sombre</button>' +
          '</div>' +
          '<div class="row">' +
            '<button type="button" data-set="scroll" data-value="0">Page qui ne défile pas</button>' +
            '<button type="button" data-set="scroll" data-value="1">Page qui défile</button>' +
          '</div>' +
          '<div class="row">' +
            '<button type="button" data-toggle="noBounce">Rebond bloqué</button>' +
            '<button type="button" data-toggle="sync">Synchro du voile</button>' +
          '</div>' +
          '<div class="row">' +
            '<button type="button" data-toggle="touch">Écouteur touchstart</button>' +
            (state.touch
              ? '<button type="button" class="press" id="press-with">Appui avec écouteur</button>'
              : '<button type="button" class="press" id="press-without">Appui sans écouteur</button>') +
          '</div>' +
          '<div class="row">' +
            '<div class="track"><div class="puck" id="puck"></div></div>' +
            '<button type="button" id="spring">Ressort</button>' +
          '</div>' +
        '</section>' +
        '<div class="filler">' + fillerHtml() + '</div>' +
      '</div>' +
      '<div class="bottom-bar">' +
        '<button type="button" class="btn-fill" id="open-veil">Ouvrir le voile</button>' +
      '</div>' +
      '<div class="veil" id="veil"></div>' +
      '<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
        '<h2 id="sheet-title">Feuille</h2>' +
        '<p>Regarde la barre d\'état et le bas de l\'écran pendant l\'ouverture.</p>' +
        '<button type="button" class="btn-fill" id="close-veil">Fermer</button>' +
      '</div>' +
      '<div class="probe probe-top" id="probe-top"></div>' +
      '<div class="probe probe-bottom" id="probe-bottom"></div>' +
      '<div class="probe probe-dvh" id="probe-dvh"></div>' +
    '</div>'

  var byId = function (id) { return document.getElementById(id) }
  var rootEl = byId('root')
  var veilOpen = false

  var render = function () {
    root.setAttribute('data-theme', state.theme)
    root.classList.toggle('no-bounce', state.noBounce)
    rootEl.classList.toggle('scrolls', state.scroll)
    rootEl.classList.toggle('veil-open', veilOpen)
    setChrome(veilOpen && state.sync ? veilOnBg(state.theme) : COLORS[state.theme].bg)

    document.querySelectorAll('[data-set]').forEach(function (b) {
      var key = b.getAttribute('data-set')
      var current = key === 'scroll' ? (state.scroll ? '1' : '0') : state[key]
      b.setAttribute('aria-pressed', String(current === b.getAttribute('data-value')))
    })
    document.querySelectorAll('[data-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(state[b.getAttribute('data-toggle')]))
    })
    window.history.replaceState(null, '', writeUrl())
  }

  var px = function (el) {
    return Math.round(el.getBoundingClientRect().height * 10) / 10 + ' px'
  }

  var measure = function () {
    byId('m-top').textContent = px(byId('probe-top'))
    byId('m-bottom').textContent = px(byId('probe-bottom'))
    byId('m-inner').textContent = window.innerHeight + ' px'
    byId('m-dvh').textContent = px(byId('probe-dvh'))
    byId('m-standalone').textContent = String(window.matchMedia('(display-mode: standalone)').matches)
    byId('m-linear').textContent = String(CSS.supports('transition-timing-function', 'linear(0, 1)'))
    byId('m-overscroll').textContent = String(CSS.supports('overscroll-behavior', 'none'))
    byId('m-ua').textContent = navigator.userAgent
  }

  var scheduleMeasure = function () {
    window.requestAnimationFrame(measure)
  }

  document.addEventListener('click', function (e) {
    var target = e.target.closest('button')
    if (!target) return

    if (target.hasAttribute('data-set')) {
      var key = target.getAttribute('data-set')
      var value = target.getAttribute('data-value')
      if (key === 'scroll') state.scroll = value === '1'
      else state[key] = value
      render()
      scheduleMeasure()
      return
    }

    if (target.hasAttribute('data-toggle')) {
      var name = target.getAttribute('data-toggle')
      state[name] = !state[name]
      if (name === 'touch') {
        // L'écouteur ne se pose qu'au chargement : on recharge avec le paramètre.
        window.location.replace(writeUrl())
        return
      }
      render()
      return
    }

    if (target.id === 'open-veil') { veilOpen = true; render(); return }
    if (target.id === 'close-veil') { veilOpen = false; render(); return }
    if (target.id === 'spring') playSpring()
  })

  byId('veil').addEventListener('click', function () {
    veilOpen = false
    render()
  })

  var supportsLinear = CSS.supports('transition-timing-function', 'linear(0, 1)')

  // Retour en place : la pastille part à droite, puis revient avec le ressort.
  var playSpring = function () {
    var puck = byId('puck')
    var track = puck.parentElement
    var distance = track.clientWidth - puck.offsetWidth - 12
    puck.style.transition = 'none'
    puck.style.transform = 'translateX(' + distance + 'px)'
    void puck.offsetWidth
    var ease = supportsLinear ? SPRING_CURVE : 'cubic-bezier(0.32, 0.72, 0, 1)'
    puck.style.transition = 'transform ' + SPRING_MS + 'ms ' + ease
    puck.style.transform = 'translateX(0)'
  }

  window.addEventListener('resize', scheduleMeasure)
  window.addEventListener('orientationchange', scheduleMeasure)
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleMeasure)
  window.matchMedia('(display-mode: standalone)').addEventListener('change', scheduleMeasure)

  render()
  measure()
})()
