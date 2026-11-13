/* =============================================================
   game.js — Mini juego pixel art "Atrapa los corazones"
   Regalo de cumpleaños 19 · web estática · vanilla JS (ES2018)
   -------------------------------------------------------------
   API pública (la llama app.js):
     window.MiniJuego.iniciar(canvasElement, {
       meta: 19,                                  // puntos para ganar
       hud: document.getElementById('hud-juego'), // muestra "♥ X / 19"
       onVictoria: function () {}                  // se llama UNA vez al ganar
     });
     window.MiniJuego.detener();   // cancela el bucle y quita listeners
   -------------------------------------------------------------
   Todo se dibuja por código: los sprites son matrices de texto.
   Sin imágenes, sin dependencias, sin game over (¡es un regalo!).
   ============================================================= */
(function () {
  'use strict';

  /* =========================================================
     1. CONSTANTES Y PALETA RETRO
     ========================================================= */
  var ALTO_LOGICO = 240;   // alto fijo del lienzo lógico (vertical)
  var ANCHO_MIN   = 96;    // límites del ancho lógico según el aspecto
  var ANCHO_MAX   = 400;
  var Y_JUGADOR   = ALTO_LOGICO - 24; // borde superior del sprite de la chica

  var COL = {
    cielo:      '#1a1033',
    cieloBajo:  '#241747',
    linea:      '#2b1a5e',
    rosa:       '#ff5fa2',
    rojo:       '#ff2e63',
    amarillo:   '#ffd166',
    blanco:     '#fff4f8',
    violeta:    '#7b5cff',
    violetaOsc: '#5a3fd1',
    piel:       '#ffdcc2',
    cesta:      '#d9a45b',
    cestaOsc:   '#8a5a2b',
    ojo:        '#2d1b4e',
    boca:       '#d94f7e',
    gris:       '#a3a8c3',
    grisOsc:    '#565a75',
    lunaOsc:    '#e0a83a',
    textoTenue: '#b7a9ea'
  };

  /* =========================================================
     2. SPRITES — pixel art definido como matrices de texto
        ('.' = transparente, cada letra = un color del mapa)
     ========================================================= */

  // Chica con canasta en alto (frame A: de pie, B: paso con piernas abiertas)
  var FILAS_CHICA_A = [
    "..bBBBBBBBBBb..",
    ".BBBBBBBBBBBBB.",
    ".BbBbBbBbBbBbB.",
    ".BBBBBBBBBBBBB.",
    "...bBBBBBBBb...",
    "...S.......S...",
    "....HHHHHHH....",
    "...HHHHHHHHH...",
    "..HHSSSSSSSHH..",
    "..HHSESSSESHH..",
    "..HHSSSSSSSHH..",
    ".....SSMSS.....",
    ".....DDDDD.....",
    "....DDDDDDD....",
    "..SDDDDDDDDDS..",
    "..DDDDDDDDDDD..",
    ".....S...S.....",
    ".....v...v....."
  ];
  var FILAS_CHICA_B = [
    "..bBBBBBBBBBb..",
    ".BBBBBBBBBBBBB.",
    ".BbBbBbBbBbBbB.",
    ".BBBBBBBBBBBBB.",
    "...bBBBBBBBb...",
    "...S.......S...",
    "....HHHHHHH....",
    "...HHHHHHHHH...",
    "..HHSSSSSSSHH..",
    "..HHSESSSESHH..",
    "..HHSSSSSSSHH..",
    ".....SSMSS.....",
    ".....DDDDD.....",
    "....DDDDDDD....",
    "..SDDDDDDDDDS..",
    "..DDDDDDDDDDD..",
    "....S.....S....",
    "....v.....v...."
  ];

  // Corazón bueno (rosa con brillo)
  var FILAS_CORAZON = [
    ".PP...PP.",
    "PWWP.PWWP",
    "PPPPPPPPP",
    "PPPPPPPPP",
    ".PPPPPPP.",
    "..PPPPP..",
    "...PPP...",
    "....P...."
  ];

  // Corazón roto (malo)
  var FILAS_CORAZON_ROTO = [
    ".RR...RR.",
    "RRRR.RRRR",
    "RRRRRRRRR",
    "RRR.RRRRR",
    ".RR.RRRR.",
    "..RR.RR..",
    "...R.R...",
    "..R...R.."
  ];

  // Nube de tormenta con carita enfadada (mala)
  var FILAS_NUBE = [
    "....GGGGG.....",
    "...GGGGGGGG...",
    "..GGGGGGGGGG..",
    ".GGGGGGGGGGGG.",
    ".GDGGGGGGGGDG.",
    ".GGDGGGGGGDGG.",
    "GGGGGGDDGGGGGG",
    ".GGGGGGGGGGGG."
  ];

  // Estrella dorada (vale +2)
  var FILAS_ESTRELLA = [
    "....Y....",
    "....Y....",
    "...YYY...",
    "Y..YYY..Y",
    "YYYYAYYYY",
    ".YYYYYYY.",
    "..YY.YY..",
    ".YY...YY."
  ];

  // Luna con cráteres (decoración de fondo)
  var FILAS_LUNA = [
    "..YYYYYY..",
    ".YYYYYYYY.",
    "YYYDYYYYYY",
    "YYYYYYYYYY",
    "YYYYYYYDYY",
    "YYDYYYYYYY",
    "YYYYYYYYYY",
    ".YYYYYYYY.",
    "..YYYYYY.."
  ];

  // Colores de las partículas al atrapar cada cosa
  var CHISPAS = {
    corazon:  [COL.rosa, COL.rojo, COL.blanco],
    estrella: [COL.amarillo, COL.blanco, '#ffe89a'],
    nube:     [COL.gris, COL.grisOsc, COL.violetaOsc],
    roto:     [COL.rojo, COL.grisOsc, COL.gris]
  };

  var SPR = null;          // canvases pequeños con cada sprite ya pintado
  var SPR_POR_TIPO = null;  // tipo de pieza -> sprite

  // Pinta una matriz de texto en un canvas diminuto (1 px por celda)
  function hacerSprite(filas, tinta) {
    var f, i, w = 0, alto = filas.length;
    for (f = 0; f < alto; f++) if (filas[f].length > w) w = filas[f].length;
    var c = document.createElement('canvas');
    c.width = w;
    c.height = alto;
    var x = c.getContext('2d');
    for (f = 0; f < alto; f++) {
      var fila = filas[f];
      for (i = 0; i < fila.length; i++) {
        var ch = fila.charAt(i);
        if (ch !== '.' && tinta[ch]) {
          x.fillStyle = tinta[ch];
          x.fillRect(i, f, 1, 1);
        }
      }
    }
    return c;
  }

  // Construye todos los sprites una sola vez (en el primer iniciar)
  function construirSprites() {
    var tintaChica = {
      b: COL.cestaOsc, B: COL.cesta, S: COL.piel, H: COL.violeta,
      E: COL.ojo, M: COL.boca, D: COL.rosa, v: COL.violetaOsc
    };
    SPR = {
      chicaA:   hacerSprite(FILAS_CHICA_A, tintaChica),
      chicaB:   hacerSprite(FILAS_CHICA_B, tintaChica),
      corazon:  hacerSprite(FILAS_CORAZON, { P: COL.rosa, W: COL.blanco }),
      roto:     hacerSprite(FILAS_CORAZON_ROTO, { R: COL.rojo }),
      nube:     hacerSprite(FILAS_NUBE, { G: COL.gris, D: COL.grisOsc }),
      estrella: hacerSprite(FILAS_ESTRELLA, { Y: COL.amarillo, A: COL.blanco }),
      luna:     hacerSprite(FILAS_LUNA, { Y: COL.amarillo, D: COL.lunaOsc })
    };
    SPR_POR_TIPO = {
      corazon: SPR.corazon,
      estrella: SPR.estrella,
      nube: SPR.nube,
      roto: SPR.roto
    };
  }

  /* =========================================================
     3. UTILIDADES PEQUEÑAS
     ========================================================= */
  function azar(a, b) { return a + Math.random() * (b - a); }
  function lijar(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function ahora() {
    return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
  }
  function fuente(px) { return px + 'px "Press Start 2P", monospace'; }

  /* =========================================================
     4. SONIDO — chiptune con Web Audio API (sin archivos)
        Se crea perezosamente en el primer gesto del usuario.
     ========================================================= */
  function crearSonido() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ctx = null;
    try { ctx = new AC(); } catch (e) { return null; }

    var maestro = ctx.createGain();
    maestro.gain.value = 0.5;
    maestro.connect(ctx.destination);

    // Un tono corto: oscilador + envolvente (click-free)
    function tono(tipo, freq, t0, dur, vol, freqFin) {
      try {
        var t = ctx.currentTime + t0;
        var osc = ctx.createOscillator();
        var env = ctx.createGain();
        osc.type = tipo;
        osc.frequency.setValueAtTime(freq, t);
        if (freqFin) osc.frequency.exponentialRampToValueAtTime(freqFin, t + dur);
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(env);
        env.connect(maestro);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      } catch (e) { /* si el audio falla, el juego sigue */ }
    }

    // Nota melódica: onda cuadrada (melodía) + triángulo (bajo octave abajo)
    function nota(f, t0, dur) {
      tono('square', f, t0, dur, 0.09);
      tono('triangle', f / 2, t0, dur, 0.06);
    }

    return {
      despertar: function () {
        try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
      },
      // Atrapar un corazón: "coin" clásico de dos saltos
      coin: function () {
        tono('square', 988, 0, 0.06, 0.06);
        tono('square', 1319, 0.06, 0.16, 0.05);
      },
      // Atrapar estrella (+2): arpegio brillante
      estrella: function () {
        tono('square', 1047, 0, 0.06, 0.06);
        tono('square', 1319, 0.05, 0.06, 0.06);
        tono('square', 1568, 0.10, 0.18, 0.06);
        tono('triangle', 3136, 0.10, 0.18, 0.04);
      },
      // Atrapar algo malo: zumbido grave descendente
      malo: function () {
        tono('square', 200, 0, 0.22, 0.10, 80);
        tono('triangle', 110, 0, 0.26, 0.09, 55);
      },
      // Jingle al empezar la partida
      inicio: function () {
        tono('triangle', 523, 0, 0.09, 0.08);
        tono('triangle', 659, 0.10, 0.09, 0.08);
        tono('triangle', 784, 0.20, 0.14, 0.08);
      },
      // "Feliz cumpleaños" (fragmento) + destello final de campanillas
      victoria: function () {
        nota(392,    0.00, 0.20);  // hap-
        nota(392,    0.22, 0.20);  // py
        nota(440,    0.44, 0.38);  // birth-
        nota(392,    0.82, 0.38);  // day
        nota(523.25, 1.20, 0.38);  // to
        nota(493.88, 1.58, 0.70);  // you
        tono('square', 1046.5, 2.42, 0.14, 0.07);
        tono('square', 1318.5, 2.56, 0.14, 0.07);
        tono('square', 1568,   2.70, 0.14, 0.07);
        tono('square', 2093,   2.84, 0.40, 0.08);
      },
      cerrar: function () {
        try { if (ctx && ctx.state !== 'closed') ctx.close(); } catch (e) {}
        ctx = null;
      }
    };
  }

  /* =========================================================
     5. ESTADO GLOBAL DEL JUEGO
     ========================================================= */
  var g = null; // instancia activa (solo puede haber una)

  // Registra oyentes para poder quitarlos TODOS en detener()
  function on(destino, evento, fn) {
    destino.addEventListener(evento, fn, { passive: false });
    g.oyentes.push([destino, evento, fn]);
  }

  /* =========================================================
     6. API PÚBLICA — iniciar / detener
     ========================================================= */
  function iniciar(canvas, opciones) {
    if (!canvas || !canvas.getContext) {
      try { console.warn('MiniJuego: canvas no válido'); } catch (e) {}
      return;
    }
    if (g) detener();            // si ya corría, arrancar de cero
    opciones = opciones || {};
    if (!SPR) construirSprites();

    var meta = opciones.meta;
    if (!(meta >= 1)) meta = 19; // por defecto la edad del cumple

    var CONT = window.CONTENIDO || {};
    var buffer = document.createElement('canvas');

    g = {
      canvas: canvas,
      dctx:   canvas.getContext('2d'),
      buffer: buffer,
      bctx:   buffer.getContext('2d'),
      hud: opciones.hud || null,
      onVictoria: (typeof opciones.onVictoria === 'function') ? opciones.onVictoria : null,
      llamada: false,            // ¿ya se llamó onVictoria?
      estado: 'intro',           // intro | juego | victoria
      meta: meta,
      pts: 0,
      t: 0, tPrev: ahora(), raf: 0,
      introTxt:    (CONT.juego && CONT.juego.intro)    || 'Atrapa los corazones',
      victoriaTxt: (CONT.juego && CONT.juego.victoria) || '¡Nivel completado!',
      nombre: CONT.nombreElla || '',
      jugador: { x: 80, objetivo: null, izq: false, der: false, animT: 0, andando: false },
      piezas: [], particulas: [], letras: [],
      estrellas: [],
      lineasCache: {},
      spawnT: 0.6, lluviaT: 0, tVict: 0,
      temblor: 0,               // sacudida de pantalla al fallar
      hudPopT: 0, hudMalT: 0,    // animaciones del HUD
      punteroId: null,
      rectUlt: { left: 0, top: 0, width: 0, height: 0 },
      dim: { ancho: 160, escala: 2, mx: 0, my: 0, dpr: 1, cssW: 0, cssH: 0 },
      oyentes: [], ro: null, medidaT: 0,
      sonido: null              // se crea en el primer gesto (autoplay policy)
    };

    // Precargar la fuente retro (si aún no está, el canvas usará monospace y
    // la cambiará solo en cuanto esté disponible, porque dibuja cada frame)
    try {
      if (document.fonts && document.fonts.load) {
        document.fonts.load('16px "Press Start 2P"');
      }
    } catch (e) { /* sin fuentes → monospace */ }

    // Estilo mínimo del canvas: llenar su contenedor, píxel nítido, sin gestos
    var st = canvas.style;
    st.touchAction = 'none';     // clave en móvil para que el dedo mueva y no haga scroll
    st.display = 'block';
    st.width = '100%';
    st.height = '100%';
    st.imageRendering = 'pixelated';
    st.background = COL.cielo;
    st.outline = 'none';
    st.userSelect = 'none';
    st.webkitTapHighlightColor = 'transparent'; // móvil: sin destello azul al tocar

    // HUD: texto HTML "♥ X / 19". Solo se impone la fuente retro inline;
    // el resto (tamaño, color, sombra) lo aporta styles.css si existe.
    if (g.hud) {
      var sh = g.hud.style;
      sh.fontFamily = '"Press Start 2P", monospace';
      sh.transformOrigin = 'center';
      sh.userSelect = 'none';
    }
    armarHud();

    // Oyentes (se quitan todos en detener)
    on(canvas, 'pointerdown',    alPresionar);
    on(canvas, 'pointermove',    alMover);
    on(canvas, 'pointerup',      alSoltar);
    on(canvas, 'pointercancel',  alSoltar);
    on(canvas, 'contextmenu',    function (e) { if (e && e.preventDefault) e.preventDefault(); });
    on(window, 'keydown', alTecla);
    on(window, 'keyup',   alSoltarTecla);
    on(window, 'resize',   recalcular);
    on(window, 'orientationchange', recalcular);
    if (window.visualViewport && window.visualViewport.addEventListener) {
      on(window.visualViewport, 'resize', recalcular);
    }
    if (typeof window.ResizeObserver === 'function') {
      try {
        g.ro = new window.ResizeObserver(function () { recalcular(); });
        g.ro.observe(canvas);
      } catch (e) { g.ro = null; }
    }

    // Estrellas parpadeantes del cielo nocturno (posiciones relativas 0-1)
    for (var i = 0; i < 46; i++) {
      g.estrellas.push({
        fx: Math.random(), fy: Math.random(),
        vel: azar(0.4, 2.4), fase: azar(0, 6.283),
        tam: Math.random() < 0.2 ? 2 : 1
      });
    }

    recalcular();
    g.jugador.x = Math.round(g.dim.ancho / 2);
    g.raf = window.requestAnimationFrame(paso);
  }

  function detener() {
    if (!g) return;
    window.cancelAnimationFrame(g.raf);
    for (var i = 0; i < g.oyentes.length; i++) {
      var o = g.oyentes[i];
      try { o[0].removeEventListener(o[1], o[2]); } catch (e) {}
    }
    if (g.ro) { try { g.ro.disconnect(); } catch (e) {} }
    if (g.sonido) g.sonido.cerrar();
    g.canvas.style.touchAction = '';
    g = null;
  }

  /* =========================================================
     7. ENTRADA — puntero (táctil/ratón) y teclado
     ========================================================= */
  var TECLAS_IZQ = { ArrowLeft: true, a: true, A: true };
  var TECLAS_DER = { ArrowRight: true, d: true, D: true };

  // Última posición del canvas en coordenadas CSS (para mapear el puntero)
  function rectDe(cv) {
    var r = { left: 0, top: 0, width: 0, height: 0 };
    try {
      var q = cv.getBoundingClientRect();
      r.left = q.left; r.top = q.top; r.width = q.width; r.height = q.height;
    } catch (e) { /* getBoundingClientRect no disponible → 0,0 */ }
    return r;
  }

  // Convierte clientX del evento en x lógico del juego (0..ancho)
  function xLogicoDe(clientX) {
    var d = g.dim, r = g.rectUlt;
    var escCss = d.escala / d.dpr;          // escala en px CSS por px lógico
    return (clientX - r.left - d.mx / d.dpr) / escCss;
  }

  // El jugador persigue el dedo (suavizado exponencial, ver moverJugador)
  function fijaObjetivo(clientX) {
    if (typeof clientX !== 'number') return;
    g.jugador.objetivo = lijar(xLogicoDe(clientX), 9, g.dim.ancho - 9);
  }

  function alPresionar(e) {
    if (!g) return;
    try { if (e.cancelable && e.preventDefault) e.preventDefault(); } catch (err) {}
    // Registrar SIEMPRE el dedo activo (incluso el toque que arranca la
    // partida) para poder arrastrar desde ese mismo gesto sin soltar
    var dedo = (e && typeof e.pointerId === 'number') ? e.pointerId : null;
    if (dedo !== null) {
      g.rectUlt = rectDe(g.canvas);
      g.punteroId = dedo;
      if (g.canvas.setPointerCapture) {
        try { g.canvas.setPointerCapture(dedo); } catch (err) {}
      }
    }
    if (g.estado === 'intro') { empezar(); return; }
    if (g.sonido) g.sonido.despertar();
    if (dedo !== null) fijaObjetivo(e.clientX);
  }

  function alMover(e) {
    if (!g || g.estado === 'intro') return;
    if (g.punteroId === null || !e || e.pointerId !== g.punteroId) return;
    fijaObjetivo(e.clientX);
  }

  function alSoltar() {
    if (!g) return;
    g.punteroId = null; // el jugador queda donde está, sin dejar de perseguir
  }

  function alTecla(e) {
    if (!g) return;
    var k = (e && e.key) || '';
    if (TECLAS_IZQ[k]) {
      g.jugador.izq = true;
      if (e.preventDefault) e.preventDefault();
    } else if (TECLAS_DER[k]) {
      g.jugador.der = true;
      if (e.preventDefault) e.preventDefault();
    } else if ((k === ' ' || k === 'Enter') && g.estado === 'intro') {
      empezar();
    }
  }

  function alSoltarTecla(e) {
    if (!g) return;
    var k = (e && e.key) || '';
    if (TECLAS_IZQ[k]) g.jugador.izq = false;
    if (TECLAS_DER[k]) g.jugador.der = false;
  }

  /* =========================================================
     8. HUD Y FLUJO DE PARTIDA
     ========================================================= */
  function armarHud() {
    if (!g || !g.hud) return;
    // Rojo un instante si se atrapó algo malo; después, el color del CSS
    g.hud.style.color = (g.hudMalT > 0) ? COL.rojo : '';
    g.hud.textContent = '\u2665 ' + g.pts + ' / ' + g.meta; // ♥ X / 19
  }

  // Empieza la partida (primer toque: aquí se crea el AudioContext,
  // dentro de un gesto del usuario, para respetar las políticas de autoplay)
  function empezar() {
    if (!g || g.estado !== 'intro') return;
    if (!g.sonido) g.sonido = crearSonido();
    if (g.sonido) { g.sonido.despertar(); g.sonido.inicio(); }
    g.estado = 'juego';
    g.spawnT = 0.35;                        // la primera pieza cae pronto
    g.jugador.x = Math.round(g.dim.ancho / 2);
    armarHud();
  }

  /* =========================================================
     9. TAMAÑOS — resolución lógica, escala, DPR y resize
     ========================================================= */
  function recalcular() {
    if (!g) return;
    var cv = g.canvas;
    var r = rectDe(cv);
    var cssW = r.width  || cv.clientWidth  || 0;
    var cssH = r.height || cv.clientHeight || 0;
    if (cssW < 10 || cssH < 10) return;     // pantalla oculta/medida 0: esperar

    var dpr = window.devicePixelRatio || 1;
    dpr = lijar(dpr, 1, 4);
    var pxW = Math.max(2, Math.round(cssW * dpr));
    var pxH = Math.max(2, Math.round(cssH * dpr));
    if (cv.width  !== pxW) cv.width  = pxW; // (asignar .width reinicia el ctx)
    if (cv.height !== pxH) cv.height = pxH;

    // Ancho lógico adaptado al aspecto (alto fijo) y acotado
    var ancho = Math.round(ALTO_LOGICO * (cssW / cssH));
    ancho = lijar(ancho, ANCHO_MIN, ANCHO_MAX);
    if (g.buffer.width  !== ancho) g.buffer.width  = ancho;
    if (g.buffer.height !== ALTO_LOGICO) g.buffer.height = ALTO_LOGICO;

    var escala = Math.min(pxW / ancho, pxH / ALTO_LOGICO);
    g.dim = {
      ancho: ancho, escala: escala, dpr: dpr,
      cssW: Math.round(cssW), cssH: Math.round(cssH),
      mx: Math.round((pxW - ancho * escala) / 2),
      my: Math.round((pxH - ALTO_LOGICO * escala) / 2)
    };

    // El reset de tamaño borra el estado del contexto: reponer lo básico
    g.bctx.imageSmoothingEnabled = false;
    g.bctx.textBaseline = 'top';
    g.rectUlt = r;
  }

  // Red de seguridad: si la sección pasa de oculta a visible (o cambia de
  // tamaño sin evento), el juego lo detecta cada medio segundo
  function comprobarTamano() {
    if (!g) return;
    g.medidaT -= 1 / 60;
    if (g.medidaT > 0) return;
    g.medidaT = 0.5;
    var w = g.canvas.clientWidth | 0, h = g.canvas.clientHeight | 0;
    if (w !== g.dim.cssW || h !== g.dim.cssH) recalcular();
  }

  /* =========================================================
     10. PIEZAS — caída de corazones / estrellas / cosas malas
     ========================================================= */

  // Suelta una pieza nueva; la dificultad crece con el progreso (dif 0..1)
  function soltar(dif) {
    if (g.piezas.length > 30) return;
    var r = Math.random();
    var probMala = 0.16 + 0.10 * dif;   // cada vez un poco más gruñonas…
    var tipo;
    if (r < probMala) {
      tipo = Math.random() < 0.5 ? 'nube' : 'roto';
    } else if (r < probMala + 0.11) {
      tipo = 'estrella';               // estrella dorada (+2)
    } else {
      tipo = 'corazon';                // el clásico corazón (+1)
    }

    var ancho = g.dim.ancho;
    var v = (26 + azar(0, 16)) * (1 + 0.5 * dif); // caen algo más rápido al final
    if (tipo === 'estrella') v *= 1.15;
    else if (tipo === 'nube' || tipo === 'roto') v *= 0.8; // las malas van suave

    var x0 = azar(10, ancho - 10);
    g.piezas.push({
      tipo: tipo, x0: x0, x: x0, y: -10,
      vy: v,
      sway: (tipo === 'nube') ? azar(6, 12) : azar(2, 6), // balanceo lateral
      vSway: azar(1.2, 2.6),
      fase: azar(0, 6.283), t: azar(0, 3)
    });
  }

  // Corazones de fiesta (lluvia de la pantalla de victoria)
  function soltarLluvia() {
    var tipos = ['corazon', 'corazon', 'estrella'];
    var tipo = tipos[(Math.random() * tipos.length) | 0];
    var ancho = g.dim.ancho;
    var x0 = azar(8, ancho - 8);
    g.piezas.push({
      tipo: tipo, x0: x0, x: x0, y: azar(-90, -6),
      vy: azar(28, 85),
      sway: azar(1, 5), vSway: azar(0.8, 2),
      fase: azar(0, 6.283), t: azar(0, 6)
    });
    if (g.piezas.length > 70) g.piezas.splice(0, g.piezas.length - 70);
  }

  /* =========================================================
     11. CAPTURAS Y VICTORIA
     ========================================================= */
  function capturar(indice, pieza) {
    g.piezas.splice(indice, 1);
    explotar(pieza.x, pieza.y, pieza.tipo);

    var esMala = pieza.tipo === 'nube' || pieza.tipo === 'roto';
    var xTexto = lijar(pieza.x, 12, g.dim.ancho - 12);

    if (esMala) {
      // Amable: resta 1 sin bajar de 0 y sin game over, solo un temblorito
      if (g.pts > 0) g.pts -= 1;
      g.temblor = 0.3;          // sacudida de pantalla
      g.hudMalT = 0.4;          // HUD en rojo un momento
      g.hudPopT = 0;
      g.letras.push({ x: xTexto, y: pieza.y - 6, t: 0, vida: 0.7, texto: '-1', color: COL.gris });
      if (g.sonido) g.sonido.malo();
    } else {
      var valor = (pieza.tipo === 'estrella') ? 2 : 1;
      g.pts += valor;
      // Si la estrella se pasa de la meta, se ajusta para que el HUD
      // final se vea limpio ("♥ 19 / 19") y no "20 / 19"
      if (g.pts > g.meta) g.pts = g.meta;
      g.hudPopT = 0.22;         // el HUD da un saltito
      g.letras.push({
        x: xTexto, y: pieza.y - 6, t: 0, vida: 0.7,
        texto: '+' + valor, color: (valor === 2) ? COL.amarillo : COL.rosa
      });
      if (g.sonido) (valor === 2 ? g.sonido.estrella() : g.sonido.coin());
    }
    armarHud();
    if (g.estado === 'juego' && g.pts >= g.meta) ganar();
  }

  function ganar() {
    g.estado = 'victoria';
    g.tVict = 0;
    g.lluviaT = 0;
    g.temblor = 0;
    g.letras.length = 0;
    g.piezas.length = 0;
    for (var i = 0; i < 26; i++) soltarLluvia();  // ráfaga inicial de corazones
    if (g.sonido) g.sonido.victoria();             // "Feliz cumpleaños" chiptune
    g.hudPopT = 0.5;
    armarHud();
  }

  /* =========================================================
     12. SIMULACIÓN — actualizar(dt)
     ========================================================= */
  function explotar(x, y, tipo) {
    var colores = CHISPAS[tipo] || CHISPAS.corazon;
    var n = 10 + ((Math.random() * 5) | 0);
    for (var i = 0; i < n; i++) {
      var a = azar(0, Math.PI * 2), vel = azar(18, 70);
      g.particulas.push({
        x: x, y: y,
        vx: Math.cos(a) * vel, vy: Math.sin(a) * vel - 20,
        t: 0, vida: azar(0.35, 0.7),
        color: colores[(Math.random() * colores.length) | 0],
        tam: Math.random() < 0.35 ? 2 : 1
      });
    }
  }

  function moverJugador(dt) {
    var j = g.jugador;
    var ancho = g.dim.ancho;
    var dir = (j.der ? 1 : 0) - (j.izq ? 1 : 0);

    if (dir !== 0) {
      // Teclado: velocidad fija (y anula el objetivo del dedo)
      j.objetivo = null;
      j.x += dir * 120 * dt;
    } else if (j.objetivo !== null && j.objetivo !== undefined) {
      // Dedo/ratón: seguimiento suavizado (independiente del framerate)
      j.x += (j.objetivo - j.x) * (1 - Math.exp(-9 * dt));
    }
    j.x = lijar(j.x, 9, ancho - 9);

    j.andando = dir !== 0 || (j.objetivo !== null && Math.abs(j.objetivo - j.x) > 3);
    if (j.andando) j.animT += dt; else j.animT = 0;
  }

  function actualizar(dt) {
    g.t += dt;
    var dif = Math.min(1, g.pts / g.meta); // progreso 0..1

    if (g.estado === 'juego') {
      // Aparecen piezas cada vez más seguido conforme se acerca la meta
      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        g.spawnT = 1.15 - 0.43 * dif + azar(-0.09, 0.09);
        soltar(dif);
      }
    } else if (g.estado === 'victoria') {
      // Lluvia de corazones + llamada única a onVictoria a los ~3.4 s
      g.tVict += dt;
      g.lluviaT -= dt;
      if (g.tVict < 8 && g.lluviaT <= 0) {
        g.lluviaT = azar(0.05, 0.12);
        soltarLluvia();
      }
      if (!g.llamada && g.tVict >= 3.4) {
        g.llamada = true;
        if (g.onVictoria) {
          try { g.onVictoria(); } catch (e) { /* no romper el juego por esto */ }
        }
        if (!g) return;   // onVictoria pudo llamar a detener()
      }
    }

    comprobarTamano();
    moverJugador(dt);

    // Piezas cayendo (+ colisión con la canasta, generosa a propósito)
    for (var i = g.piezas.length - 1; i >= 0; i--) {
      var p = g.piezas[i];
      if (!p) continue;
      p.t += dt;
      p.y += p.vy * dt;
      p.x = p.x0 + Math.sin(p.t * p.vSway + p.fase) * p.sway;

      if (g.estado === 'juego' &&
          p.y + 4 >= Y_JUGADOR && p.y - 4 <= Y_JUGADOR + 8 &&
          Math.abs(p.x - g.jugador.x) <= 11) {
        capturar(i, p);
        if (g.estado !== 'juego') break; // ganó: ganar() vació la lista
        continue;
      }
      if (p.y - 10 > ALTO_LOGICO) g.piezas.splice(i, 1); // se fue por abajo
    }

    // Partículas pixel
    for (i = g.particulas.length - 1; i >= 0; i--) {
      var q = g.particulas[i];
      q.t += dt;
      if (q.t >= q.vida) { g.particulas.splice(i, 1); continue; }
      q.vy += 150 * dt;                       // gravedad
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }

    // Textos flotantes "+1 / +2 / -1"
    for (i = g.letras.length - 1; i >= 0; i--) {
      var l = g.letras[i];
      l.t += dt;
      if (l.t >= l.vida) { g.letras.splice(i, 1); continue; }
      l.y -= 16 * dt;
    }

    // Temporizadores varios
    if (g.temblor > 0) g.temblor = Math.max(0, g.temblor - dt);
    if (g.hudPopT > 0) {
      g.hudPopT -= dt;
      if (g.hud) {
        var f = Math.max(0, g.hudPopT) / 0.22;
        g.hud.style.transform = 'scale(' + (1 + 0.15 * f).toFixed(3) + ')';
        if (g.hudPopT <= 0) g.hud.style.transform = '';
      }
    }
    if (g.hudMalT > 0) {
      g.hudMalT -= dt;
      if (g.hudMalT <= 0) { g.hudMalT = 0; armarHud(); }
    }
  }

  /* =========================================================
     13. BUCLE PRINCIPAL — requestAnimationFrame
     ========================================================= */
  function paso(marca) {
    if (!g) return;                         // detener() pudo haberse llamado
    var t = (typeof marca === 'number') ? marca : ahora();
    g.raf = window.requestAnimationFrame(paso);

    var dt = (t - g.tPrev) / 1000;          // segundos desde el frame anterior
    g.tPrev = t;
    if (!(dt > 0)) dt = 0.001;              // nunca dt negativo
    if (dt > 0.05) dt = 0.05;               // ni saltos enormes (pestaña oculta)

    actualizar(dt);
    if (g) dibujar();                      // onVictoria() pudo pausar/detener
  }

  /* =========================================================
     14. DIBUJADO — todo en un buffer lógico pequeño y luego
         un único volcado escalado con smoothing desactivado
     ========================================================= */
  function dibujar() {
    var d = g.dim;
    var bc = g.bctx;

    bc.setTransform(1, 0, 0, 1, 0, 0);
    bc.imageSmoothingEnabled = false;
    bc.textBaseline = 'top';

    pintarFondo(bc, d.ancho);
    dibujarJugador(bc);
    dibujarPiezas(bc);
    dibujarParticulas(bc);
    dibujarLetras(bc);

    // Destello rojo suave cuando se atrapa algo malo
    if (g.temblor > 0) {
      bc.fillStyle = 'rgba(255,46,99,' + (0.10 * g.temblor / 0.3).toFixed(3) + ')';
      bc.fillRect(0, 0, d.ancho, ALTO_LOGICO);
    }

    if (g.estado === 'intro') dibujarIntro(bc, d.ancho);
    else if (g.estado === 'victoria') dibujarVictoria(bc, d.ancho);

    // ---- Volcado nítido del buffer al canvas visible (escala + temblor) ----
    var dc = g.dctx;
    var sx = 0, sy = 0;
    if (g.temblor > 0) {
      var f2 = (g.temblor / 0.3) * 2.2;
      sx = Math.round((Math.random() * 2 - 1) * f2);
      sy = Math.round((Math.random() * 2 - 1) * f2);
    }
    dc.setTransform(1, 0, 0, 1, 0, 0);
    dc.imageSmoothingEnabled = false;
    dc.fillStyle = COL.cielo;                 // barras de margen del mismo cielo
    dc.fillRect(0, 0, g.canvas.width, g.canvas.height);
    dc.drawImage(g.buffer, d.mx + sx, d.my + sy,
                 Math.round(d.ancho * d.escala), Math.round(ALTO_LOGICO * d.escala));
  }

  // Cielo nocturno: estrellas parpadeantes, luna y suelo
  function pintarFondo(bc, ancho) {
    bc.fillStyle = COL.cielo;
    bc.fillRect(0, 0, ancho, ALTO_LOGICO);

    for (var i = 0; i < g.estrellas.length; i++) {
      var e = g.estrellas[i];
      var br = 0.25 + 0.75 * Math.abs(Math.sin(g.t * e.vel + e.fase));
      if (br < 0.3) continue;                 // apagada un instante
      bc.fillStyle = 'rgba(255,244,248,' + br.toFixed(2) + ')';
      bc.fillRect(Math.round(e.fx * ancho), Math.round(e.fy * (ALTO_LOGICO - 40)), e.tam, e.tam);
    }

    bc.drawImage(SPR.luna, ancho - 16, 12);   // luna pixel esquina superior

    bc.fillStyle = COL.cieloBajo;             // franja de horizonte
    bc.fillRect(0, ALTO_LOGICO - 32, ancho, 32);
    bc.fillStyle = COL.linea;                 // línea del suelo
    bc.fillRect(0, ALTO_LOGICO - 6, ancho, 2);
  }

  // La chica con la canasta (dos frames de caminar + respiración quieta)
  function dibujarJugador(bc) {
    var j = g.jugador;
    var cuadroA = SPR.chicaA, cuadroB = SPR.chicaB;
    var paso2 = Math.floor(j.animT / 0.14) % 2 === 1;
    var cuadro = (j.andando && paso2) ? cuadroB : cuadroA;
    var bobo;
    if (j.andando) bobo = paso2 ? -1 : 0;                       // saltito al andar
    else bobo = (Math.sin(g.t * 2.2) > 0) ? 0 : -1;             // respiración
    bc.drawImage(cuadro, Math.round(j.x - cuadroA.width / 2), Y_JUGADOR + bobo);
  }

  function dibujarPiezas(bc) {
    for (var i = 0; i < g.piezas.length; i++) {
      var p = g.piezas[i];
      if (!p) continue;
      var spr = SPR_POR_TIPO[p.tipo];
      if (!spr) continue;
      if (p.tipo === 'estrella') {            // las estrellas titilan
        bc.globalAlpha = 0.8 + 0.2 * Math.sin(p.t * 9 + p.fase);
      }
      bc.drawImage(spr, Math.round(p.x - spr.width / 2), Math.round(p.y - spr.height / 2));
      bc.globalAlpha = 1;
    }
  }

  function dibujarParticulas(bc) {
    for (var i = 0; i < g.particulas.length; i++) {
      var q = g.particulas[i];
      bc.globalAlpha = Math.max(0, 1 - q.t / q.vida);
      bc.fillStyle = q.color;
      bc.fillRect(Math.round(q.x), Math.round(q.y), q.tam, q.tam);
    }
    bc.globalAlpha = 1;
  }

  function dibujarLetras(bc) {
    bc.font = fuente(8);
    bc.textAlign = 'center';
    bc.textBaseline = 'top';
    for (var i = 0; i < g.letras.length; i++) {
      var l = g.letras[i];
      bc.globalAlpha = Math.max(0, 1 - l.t / l.vida);
      var x = Math.round(l.x), y = Math.round(l.y);
      bc.fillStyle = '#1a1033';               // sombrita
      bc.fillText(l.texto, x + 1, y + 1);
      bc.fillStyle = l.color;
      bc.fillText(l.texto, x, y);
    }
    bc.globalAlpha = 1;
  }

  /* =========================================================
     15. TEXTOS Y PANTALLAS (intro / victoria)
     ========================================================= */

  // Envuelve un texto en varias líneas según el ancho disponible
  function envolver(texto, maxAncho, px) {
    var bc = g.bctx;
    bc.font = fuente(px);
    var palabras = String(texto).split(' ');
    var lineas = [], actual = '';
    for (var i = 0; i < palabras.length; i++) {
      var prueba = actual ? actual + ' ' + palabras[i] : palabras[i];
      if (bc.measureText(prueba).width <= maxAncho || !actual) {
        actual = prueba;
      } else {
        lineas.push(actual);
        actual = palabras[i];
      }
    }
    if (actual) lineas.push(actual);
    return lineas;
  }

  // Cache de líneas: solo se recalcula si cambia el texto o el ancho
  function lineasDe(cadena, clave) {
    var ancho = g.buffer.width;
    var c = g.lineasCache[clave];
    if (!c || c.ancho !== ancho || c.cadena !== cadena) {
      c = { ancho: ancho, cadena: cadena, lineas: envolver(cadena, ancho - 14, 8) };
      g.lineasCache[clave] = c;
    }
    return c.lineas;
  }

  function textoCentrado(cadena, y, px, color, sombra) {
    var bc = g.bctx;
    bc.font = fuente(px);
    bc.textAlign = 'center';
    bc.textBaseline = 'top';
    var cx = Math.round(g.buffer.width / 2);
    if (sombra) {
      bc.fillStyle = sombra;
      bc.fillText(cadena, cx + 1, y + 1);
    }
    bc.fillStyle = color;
    bc.fillText(cadena, cx, y);
  }

  // Pantalla inicial: corazón latiendo + intro + "toca para empezar"
  function dibujarIntro(bc, ancho) {
    var cor = SPR.corazon;

    // Corazón grande que late (3x / 4x)
    var esc = Math.sin(g.t * 3.0) > 0.15 ? 4 : 3;
    bc.drawImage(cor,
      Math.round(ancho / 2 - cor.width * esc / 2), 30,
      cor.width * esc, cor.height * esc);

    // Frase de intro de contenido.js (envuelta)
    var lineas = lineasDe(g.introTxt, 'intro');
    var y = 84;
    for (var i = 0; i < lineas.length; i++) {
      textoCentrado(lineas[i], y, 8, COL.blanco, COL.violetaOsc);
      y += 12;
    }

    // "TOCA PARA EMPEZAR" parpadeando + pista de controles
    if ((g.t % 1.1) < 0.75) {
      textoCentrado('TOCA PARA EMPEZAR', ALTO_LOGICO - 76, 8, COL.amarillo, COL.rojo);
    }
    textoCentrado('FLECHAS O TU DEDO', ALTO_LOGICO - 52, 6, COL.textoTenue);
  }

  // Pantalla de victoria: lluvia de corazones + texto ganador
  function dibujarVictoria(bc, ancho) {
    var lineas = lineasDe(g.victoriaTxt, 'victoria');
    var y0 = Math.round(ALTO_LOGICO * 0.28);

    // Banda oscura para que se lea bien
    var altoBandas = lineas.length * 12 + 46 + (g.nombre ? 14 : 0);
    bc.fillStyle = 'rgba(26,16,51,0.66)';
    bc.fillRect(0, y0 - 14, ancho, altoBandas);

    var y = y0;
    for (var i = 0; i < lineas.length; i++) {
      textoCentrado(lineas[i], y, 8, COL.blanco, COL.rojo);
      y += 12;
    }

    // "♥ 19 / 19" y un guiño con su nombre
    textoCentrado('\u2665 ' + g.meta + ' / ' + g.meta, y + 6, 10, COL.amarillo, COL.rojo);
    if (g.nombre) {
      textoCentrado('Te quiero, ' + g.nombre + ' \u2665', y + 26, 6, COL.rosa);
    }
  }

  /* =========================================================
     16. API PÚBLICA
     ========================================================= */
  window.MiniJuego = {
    iniciar: iniciar,
    detener: detener
  };
})();