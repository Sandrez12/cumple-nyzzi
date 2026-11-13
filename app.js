/* ======================================================================
   CUMPLE 19 — app.js
   ----------------------------------------------------------------------
   Lógica de la web-regalo de cumpleaños (vanilla JS, sin dependencias).

   FLUJO GENERAL:
     1) Si la URL NO trae ?preview y todavía no llega la hora de
        CONTENIDO.fechaDesbloqueo, se muestra #pantalla-bloqueo con una
        cuenta regresiva que sola pasa al inicio al llegar a cero.
     2) #pantalla-inicio ("PRESS START") arranca la música de fondo y el
        mini juego. Si window.MiniJuego no existe, salta directo al menú.
     3) Al ganar el juego se guarda en localStorage y se abre el menú.
     4) El menú abre las secciones (recuerdos, razones, distancia,
        galería, canciones, cupones y carta). Cada una se renderiza bajo demanda y
        guarda lo descubierto (secciones visitadas, cartas volteadas,
        cupones canjeados).
     5) #estrellas dibuja el cielo pixelado animado (JS + CSS).

   NOTAS DE ROBUSTEZ:
   - contenido.js define window.CONTENIDO y game.js expone
     window.MiniJuego.iniciar / window.MiniJuego.detener.
   - Las fotos, la canción y los mensajes PUEDEN no existir todavía:
     todo se degrada con gracia (marco con corazón, botón "pronto", etc).
   - Todo uso de localStorage, getUserMedia o audio.play() está
     envuelto en try/catch.
   ====================================================================== */

'use strict';

(function () {
  /* ==================================================================
     0. REFERENCIAS RÁPIDAS Y CONTENIDO
     ================================================================== */
  const $  = (sel, raiz) => (raiz || document).querySelector(sel);
  const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));

  const CONTENIDO = window.CONTENIDO || {};

  /* Datos principales con valores por defecto si algo falta */
  const NOMBRE_ELLA = CONTENIDO.nombreElla || 'amor';
  const NOMBRE_EL   = CONTENIDO.nombreEl || '';
  const EDAD        = Number(CONTENIDO.edad) || 19;
  const CANCION     = CONTENIDO.cancion || {};
  const RECUERDOS   = Array.isArray(CONTENIDO.recuerdos) ? CONTENIDO.recuerdos : [];
  const RAZONES     = Array.isArray(CONTENIDO.razones) ? CONTENIDO.razones : [];
  const DISTANCIA   = CONTENIDO.distancia || {};
  const LISTA_MEDIA = Array.isArray(CONTENIDO.media) ? CONTENIDO.media : [];
  const CUPONES     = Array.isArray(CONTENIDO.cupones) ? CONTENIDO.cupones : [];
  const CARTA       = Array.isArray(CONTENIDO.carta) ? CONTENIDO.carta.filter(Boolean) : [];

  /* ¿Modo de prueba? (?preview evita la espera del desbloqueo) */
  const MODO_PREVIEW = (function () {
    try { return new URLSearchParams(window.location.search).has('preview'); }
    catch (e) { return window.location.search.indexOf('preview') !== -1; }
  })();

  /* Preferencias de accesibilidad */
  const reduceMotion = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* Escapa texto para insertarlo con seguridad en plantillas innerHTML */
  function esc(texto) {
    const tmp = document.createElement('div');
    tmp.textContent = texto == null ? '' : String(texto);
    return tmp.innerHTML;
  }

  /* Ceros a la izquierda: 7 -> "07" */
  const pad = (n) => String(n).padStart(2, '0');

  /* Fecha ISO ("2025-01-01") formateada en español */
  function fechaES(iso) {
    try {
      const fecha = new Date(String(iso) + 'T12:00:00'); /* mediodía: sin sorpresas de zona */
      if (isNaN(fecha.getTime())) return String(iso || '');
      return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return String(iso || '');
    }
  }

  /* Distancia en km entre dos puntos (fórmula del haversine) */
  function haversineKm(lat1, lon1, lat2, lon2) {
    const RAD = Math.PI / 180;
    const dLat = (lat2 - lat1) * RAD;
    const dLon = (lon2 - lon1) * RAD;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* Minutos:segundos para los reproductores */
  function formatoTiempo(seg) {
    if (!isFinite(seg) || seg < 0) return '0:00';
    const m = Math.floor(seg / 60);
    const s = Math.floor(seg % 60);
    return m + ':' + pad(s);
  }

  /* ==================================================================
     1. ALMACENAMIENTO SEGURO (localStorage siempre en try/catch)
     ================================================================== */
  const CLAVES = {
    YA_GANO:   'cumple19:yaGano',
    VISITADAS: 'cumple19:visitadas',
    CUPONES:   'cumple19:cupones',
    CARTAS:    'cumple19:cartas'
  };

  function leerAlmacen(clave, defecto) {
    try {
      const bruto = window.localStorage.getItem(clave);
      if (bruto === null || bruto === undefined) return defecto;
      return JSON.parse(bruto);
    } catch (e) {
      return defecto; /* almacenamiento bloqueado o JSON corrupto */
    }
  }

  function escribirAlmacen(clave, valor) {
    try {
      window.localStorage.setItem(clave, JSON.stringify(valor));
    } catch (e) {
      /* modo privado / sin espacio: simplemente no se persiste */
    }
  }

  /* ==================================================================
     2. ESTADO INTERNO DE LA APP
     ================================================================== */
  const estado = {
    pantallaActual: '',                 /* id de la pantalla visible */
    yaGano:    !!leerAlmacen(CLAVES.YA_GANO, false),
    visitadas: new Set(leerAlmacen(CLAVES.VISITADAS, [])),
    canjeados: new Set(leerAlmacen(CLAVES.CUPONES, [])),
    cartas:    new Set(leerAlmacen(CLAVES.CARTAS, [])),
    intervalBloqueo: 0,                 /* setInterval de la cuenta atrás */
    audioCtx: null,                     /* AudioContext para bips chiptune */
    musica: null,                       /* <audio id="musica"> */
    btnMusica: null,                    /* <button id="btn-musica"> */
    musicaConError: false,              /* true si la canción no carga */
    volMusica: 0.75,                    /* volumen normal de la música */
    medios: [],                         /* reproductores de la sección media */
    soplando: false,                    /* evita soplar dos veces */
    generacionCarta: 0,                 /* cancela la máquina de escribir */
    micro: { activo: false, stream: null, ctx: null, raf: 0 },
    avisoTimer: 0
  };

  /* ==================================================================
     3. SONIDO CHIPTUNE (bips generados, sin archivos)
     ================================================================== */
  function bip(frecuencia, duracion, tipo, volumen) {
    try {
      if (!estado.audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        estado.audioCtx = new AC();
      }
      const ctx = estado.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const ganancia = ctx.createGain();
      osc.type = tipo || 'square';
      osc.frequency.value = frecuencia || 440;
      const ahora = ctx.currentTime;
      ganancia.gain.setValueAtTime(volumen || 0.08, ahora);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + (duracion || 0.08));
      osc.connect(ganancia);
      ganancia.connect(ctx.destination);
      osc.start(ahora);
      osc.stop(ahora + (duracion || 0.08) + 0.02);
    } catch (e) {
      /* sin audio disponible: silencio, no pasa nada */
    }
  }

  /* pequeña fanfarria de victoria */
  function fanfarria() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => bip(f, 0.12, 'square', 0.07), i * 110);
    });
  }

  /* ==================================================================
     4. AVISOS (toast pixel que se oculta solo)
     ================================================================== */
  function avisar(texto, milisegundos) {
    try {
      let nodo = document.getElementById('aviso');
      if (!nodo) {
        nodo = document.createElement('div');
        nodo.id = 'aviso';
        nodo.className = 'aviso';
        nodo.setAttribute('role', 'status');
        document.body.appendChild(nodo);
      }
      nodo.textContent = texto;
      nodo.classList.add('visible');
      clearTimeout(estado.avisoTimer);
      estado.avisoTimer = setTimeout(() => {
        nodo.classList.remove('visible');
      }, milisegundos || 3200);
    } catch (e) { /* ignorar */ }
  }

  /* ==================================================================
     5. CONFETI PIXEL (piezas cuadradas cayendo)
     ================================================================== */
  function lanzarConfeti(cantidad) {
    if (reduceMotion) return; /* accesibilidad: sin confeti animado */
    try {
      const total = cantidad || 110;
      let caja = document.getElementById('confeti');
      if (caja) caja.remove();
      caja = document.createElement('div');
      caja.id = 'confeti';
      caja.className = 'confeti';
      caja.setAttribute('aria-hidden', 'true');
      const colores = ['#ff5fa2', '#ff2e63', '#ffd166', '#fff4f8', '#7b5cff'];
      for (let i = 0; i < total; i++) {
        const pieza = document.createElement('i');
        pieza.className = 'pieza' + (i % 3 === 0 ? ' larga' : '');
        pieza.style.left = (Math.random() * 100).toFixed(2) + '%';
        pieza.style.background = colores[Math.floor(Math.random() * colores.length)];
        pieza.style.animationDuration = (1.2 + Math.random() * 1.4).toFixed(2) + 's';
        pieza.style.animationDelay = (Math.random() * 0.6).toFixed(2) + 's';
        pieza.style.setProperty('--deriva', ((Math.random() * 80) - 40).toFixed(0) + 'px');
        pieza.style.setProperty('--giro', Math.floor(Math.random() * 360) + 'deg');
        caja.appendChild(pieza);
      }
      document.body.appendChild(caja);
      setTimeout(() => { if (caja && caja.remove) caja.remove(); }, 3800);
    } catch (e) { /* ignorar */ }
  }

  /* ==================================================================
     6. GESTIÓN DE PANTALLAS (solo una .activa a la vez)
     ================================================================== */
  function mostrarPantalla(id) {
    const destino = document.getElementById(id);
    if (!destino) return;
    const anterior = estado.pantallaActual;
    $$('.pantalla').forEach((p) => p.classList.remove('activa'));
    destino.classList.add('activa');
    estado.pantallaActual = id;
    try { window.scrollTo(0, 0); } catch (e) { /* ignorar */ }

    /* limpieza al salir de pantallas con sonido/permisos activos */
    if (anterior === 'sec-media' && id !== 'sec-media') pausarMedios();
    if (anterior === 'sec-carta' && id !== 'sec-carta') detenerMicro();
  }

  /* ==================================================================
     7. CIELO DE ESTRELLAS (#estrellas, parpadean con CSS)
     ================================================================== */
  function crearEstrellas() {
    const cielo = document.getElementById('estrellas');
    if (!cielo) return;
    try {
      const fragmento = document.createDocumentFragment();
      const tonos = ['', 'tono-rosa', 'tono-amarillo', 'tono-violeta'];
      for (let i = 0; i < 110; i++) {
        const estrella = document.createElement('i');
        estrella.className = 'estrella' +
          (Math.random() < 0.3 ? ' mediana' : '') + ' ' +
          tonos[Math.floor(Math.random() * tonos.length)];
        estrella.style.left = (Math.random() * 100).toFixed(2) + '%';
        estrella.style.top = (Math.random() * 100).toFixed(2) + '%';
        estrella.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
        estrella.style.animationDuration = (1.6 + Math.random() * 2.4).toFixed(2) + 's';
        fragmento.appendChild(estrella);
      }
      cielo.appendChild(fragmento);
    } catch (e) { /* ignorar */ }
  }

  /* ==================================================================
     8. MÚSICA DE FONDO (#musica + #btn-musica)
     ================================================================== */
  function prepararMusica() {
    estado.musica = document.getElementById('musica');
    estado.btnMusica = document.getElementById('btn-musica');
    if (!estado.musica || !estado.btnMusica) return;

    const archivo = CANCION && CANCION.archivo;
    if (archivo) {
      try {
        estado.musica.src = archivo;
        estado.musica.volume = estado.volMusica;
      } catch (e) { estado.musicaConError = true; }
      /* si la canción no existe / no carga: ocultamos el botón de música */
      estado.musica.addEventListener('error', () => {
        estado.musicaConError = true;
        ocultarBtnMusica();
      });
    } else {
      estado.musicaConError = true;
    }

    estado.btnMusica.addEventListener('click', alternarMusica);
  }

  function ocultarBtnMusica() {
    if (estado.btnMusica) estado.btnMusica.hidden = true;
  }

  function mostrarBtnMusica() {
    if (estado.btnMusica && !estado.musicaConError) estado.btnMusica.hidden = false;
  }

  /* intenta reproducir (siempre hay gesto de usuario de por medio) */
  function intentarTocarMusica() {
    const m = estado.musica;
    if (!m || estado.musicaConError) return;
    try {
      const promesa = m.play();
      if (promesa && typeof promesa.catch === 'function') {
        promesa.catch(() => { /* política de autoplay: silencio */ });
      }
      mostrarBtnMusica();
      estado.btnMusica.classList.remove('apagada');
      estado.btnMusica.setAttribute('aria-pressed', 'true');
    } catch (e) { /* ignorar */ }
  }

  /* pausar / reanudar desde el botón flotante */
  function alternarMusica() {
    const m = estado.musica;
    if (!m || estado.musicaConError) return;
    try {
      if (m.paused) {
        const promesa = m.play();
        if (promesa && typeof promesa.catch === 'function') promesa.catch(() => {});
        estado.btnMusica.classList.remove('apagada');
        estado.btnMusica.setAttribute('aria-pressed', 'true');
      } else {
        m.pause();
        estado.btnMusica.classList.add('apagada');
        estado.btnMusica.setAttribute('aria-pressed', 'false');
      }
    } catch (e) { /* ignorar */ }
  }

  /* bajar/restaurar volumen mientras suena un mensaje de la sección media */
  function bajarVolumenMusica() {
    try {
      if (estado.musica && !estado.musica.paused) estado.musica.volume = 0.12;
    } catch (e) { /* ignorar */ }
  }

  function restaurarVolumenMusica() {
    try {
      if (estado.musica) estado.musica.volume = estado.volMusica;
    } catch (e) { /* ignorar */ }
  }

  /* ==================================================================
     9. PANTALLA DE BLOQUEO (cuenta regresiva hasta fechaDesbloqueo)
     ================================================================== */
  function iniciarBloqueo() {
    let objetivo = NaN;
    try { objetivo = new Date(CONTENIDO.fechaDesbloqueo).getTime(); } catch (e) { objetivo = NaN; }

    /* sin fecha válida, ya desbloqueada o ?preview → directo al inicio */
    if (MODO_PREVIEW || isNaN(objetivo) || Date.now() >= objetivo) {
      irAInicio();
      return;
    }

    mostrarPantalla('pantalla-bloqueo');

    const caja = document.getElementById('cuenta-regresiva');
    const numeros = {};
    if (caja) {
      caja.innerHTML = '';
      const partes = [
        ['dias', 'DIAS'],
        ['horas', 'HORAS'],
        ['minutos', 'MIN'],
        ['segundos', 'SEG']
      ];
      partes.forEach(([clave, etiqueta]) => {
        const medidor = document.createElement('div');
        medidor.className = 'medidor';
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = '00';
        const etq = document.createElement('span');
        etq.className = 'etq';
        etq.textContent = etiqueta;
        medidor.appendChild(num);
        medidor.appendChild(etq);
        caja.appendChild(medidor);
        numeros[clave] = num;
      });
    }

    function tic() {
      const falta = objetivo - Date.now();
      if (falta <= 0) {
        /* llegó la hora: pasa sola al inicio */
        clearInterval(estado.intervalBloqueo);
        irAInicio();
        return;
      }
      const s = Math.floor(falta / 1000);
      if (numeros.dias) numeros.dias.textContent = pad(Math.floor(s / 86400));
      if (numeros.horas) numeros.horas.textContent = pad(Math.floor((s % 86400) / 3600));
      if (numeros.minutos) numeros.minutos.textContent = pad(Math.floor((s % 3600) / 60));
      if (numeros.segundos) numeros.segundos.textContent = pad(s % 60);
    }

    tic();
    estado.intervalBloqueo = setInterval(tic, 1000);
  }

  /* ==================================================================
     10. PANTALLA DE INICIO
     ================================================================== */
  function irAInicio() {
    mostrarPantalla('pantalla-inicio');

    const titulo = document.getElementById('titulo-inicio');
    if (titulo) titulo.textContent = 'Feliz cumple ' + NOMBRE_ELLA + '!';

    /* si ya ganó el juego en otra visita, puede saltar directo al menú */
    if (estado.yaGano) agregarBotonSaltar();
  }

  function agregarBotonSaltar() {
    if (document.getElementById('btn-saltar')) return;
    const btnStart = document.getElementById('btn-start');
    if (!btnStart) return;
    try {
      const boton = document.createElement('button');
      boton.id = 'btn-saltar';
      boton.type = 'button';
      boton.className = 'btn-pixel amarillo';
      boton.textContent = 'Saltar al menú';
      btnStart.insertAdjacentElement('afterend', boton);
      boton.addEventListener('click', () => {
        intentarTocarMusica();
        irAlMenu();
      });
    } catch (e) { /* ignorar */ }
  }

  /* ==================================================================
     11. MINI JUEGO (game.js expone window.MiniJuego)
     ================================================================== */
  function comenzarExperiencia() {
    intentarTocarMusica();
    bip(660, 0.07, 'square', 0.06);

    const canvas = document.getElementById('juego');
    const hayJuego = window.MiniJuego &&
      typeof window.MiniJuego.iniciar === 'function' && canvas;

    if (hayJuego) {
      mostrarPantalla('pantalla-juego');
      try {
        window.MiniJuego.iniciar(canvas, {
          meta: EDAD, /* hearts to catch: the age (19) */
          hud: document.getElementById('hud-juego'),
          onVictoria: alGanarJuego
        });
      } catch (e) {
        irAlMenu(); /* si el juego falla al arrancar: directo al menú */
      }
    } else {
      /* degradación: sin game.js, la leyenda salta al menú */
      irAlMenu();
    }
  }

  function alGanarJuego() {
    try {
      if (window.MiniJuego && typeof window.MiniJuego.detener === 'function') {
        window.MiniJuego.detener();
      }
    } catch (e) { /* ignorar */ }

    /* se recuerda que ya ganó (try/catch dentro de escribirAlmacen) */
    estado.yaGano = true;
    escribirAlmacen(CLAVES.YA_GANO, true);

    irAlMenu();
    fanfarria();
    lanzarConfeti(70);
  }

  /* ==================================================================
     12. MENÚ PRINCIPAL
     ================================================================== */
  function irAlMenu() {
    const titulo = document.getElementById('titulo-menu');
    if (titulo) titulo.textContent = 'Elige tu regalo';
    agregarBotonCancion();
    actualizarMarcasMenu();
    mostrarPantalla('pantalla-menu');
  }

  /* marca con ✓ los botones de secciones ya visitadas */
  function actualizarMarcasMenu() {
    $$('.btn-menu').forEach((boton) => {
      const id = boton.getAttribute('data-seccion');
      boton.classList.toggle('visitada', !!id && estado.visitadas.has(id));
    });
  }

  /* ==================================================================
     13. SECCIONES: marco común (botón "◀ Volver" + título + render lazy)
     ================================================================== */
  const TITULOS_SECCION = {
    'sec-recuerdos': 'Nuestros recuerdos',
    'sec-razones':   '19 razones',
    'sec-distancia': 'La distancia',
    'sec-media':     'Nuestra galería',
    'sec-canciones': 'Nuestras canciones',
    'sec-cupones':   'Vales canjeables',
    'sec-carta':     'Tu pastel y mi carta'
  };

  function abrirSeccion(id) {
    const seccion = document.getElementById(id);
    if (!seccion) return;
    const cont = seccion.querySelector('.contenido-seccion');

    /* primera visita: se arma la estructura y se renderiza el contenido */
    if (cont && !cont.childElementCount) {
      const volver = document.createElement('button');
      volver.type = 'button';
      volver.className = 'btn-volver';
      volver.textContent = '◀ Volver';
      volver.addEventListener('click', irAlMenu);
      cont.appendChild(volver);

      const titulo = document.createElement('h2');
      titulo.className = 'titulo-seccion';
      titulo.textContent = TITULOS_SECCION[id] || '';
      cont.appendChild(titulo);

      try {
        RENDERIZADORES[id](cont);
      } catch (e) {
        mensajeVacio(cont, 'Esta sección se está puliendo... vuelve en un rato');
      }
    }

    /* se marca como visitada (para el ✓ del menú) */
    if (!estado.visitadas.has(id)) {
      estado.visitadas.add(id);
      escribirAlmacen(CLAVES.VISITADAS, Array.from(estado.visitadas));
    }
    actualizarMarcasMenu();
    bip(520, 0.05, 'square', 0.05);
    mostrarPantalla(id);
  }

  function mensajeVacio(cont, texto) {
    const p = document.createElement('p');
    p.className = 'vacio';
    p.textContent = texto;
    cont.appendChild(p);
  }

  /* ==================================================================
     14. SECCIÓN RECUERDOS (mapa de niveles + polaroids + lightbox)
     ================================================================== */
  function renderRecuerdos(cont) {
    if (!RECUERDOS.length) {
      mensajeVacio(cont, 'Los recuerdos aún se están escribiendo...');
      return;
    }

    const linea = document.createElement('div');
    linea.className = 'linea-tiempo';

    RECUERDOS.forEach((recuerdo, i) => {
      const rec = recuerdo || {};
      const nivel = document.createElement('article');
      nivel.className = 'nivel';

      const etiqueta = document.createElement('p');
      etiqueta.className = 'nivel-etiqueta';
      etiqueta.textContent = 'Nivel ' + (i + 1);

      const titulo = document.createElement('h3');
      titulo.className = 'nivel-titulo';
      titulo.textContent = rec.titulo || '';

      nivel.appendChild(etiqueta);

      if (rec.fecha) {
        const fecha = document.createElement('p');
        fecha.className = 'nivel-fecha';
        fecha.textContent = fechaES(rec.fecha);
        nivel.appendChild(fecha);
      }

      nivel.appendChild(titulo);

      if (rec.texto) {
        const texto = document.createElement('p');
        texto.className = 'nivel-texto';
        texto.textContent = rec.texto;
        nivel.appendChild(texto);
      }

      /* polaroid pixel: si la foto falla, marco con un corazón */
      /* foto puede ser un texto o una lista de fotos */
      const fotosNivel = (Array.isArray(rec.foto) ? rec.foto : [rec.foto]).filter(Boolean);
      const grupoFotos = document.createElement('div');
      grupoFotos.className = fotosNivel.length > 1 ? 'nivel-fotos varias' : 'nivel-fotos';
      fotosNivel.forEach((srcFoto) => {
        const polaroid = document.createElement('button');
        polaroid.type = 'button';
        polaroid.className = 'polaroid';
        polaroid.setAttribute('aria-label', 'Ver foto: ' + (rec.titulo || 'recuerdo'));

        const ventana = document.createElement('div');
        ventana.className = 'polaroid-ventana';

        const img = new Image();
        img.alt = rec.titulo || 'Recuerdo';
        img.loading = 'lazy';
        img.addEventListener('error', () => {
          ventana.classList.add('polaroid-error');
          ventana.innerHTML = '<span class="sprite-corazon medio" aria-hidden="true"></span>';
        });

        const pie = document.createElement('span');
        pie.className = 'polaroid-pie';
        pie.textContent = 'Toca para ver';

        ventana.appendChild(img);
        polaroid.appendChild(ventana);
        polaroid.appendChild(pie);
        polaroid.addEventListener('click', () => abrirLightbox(srcFoto));

        grupoFotos.appendChild(polaroid);
        img.src = srcFoto; /* listeners primero, src después */
      });
      if (fotosNivel.length) nivel.appendChild(grupoFotos);

      linea.appendChild(nivel);
    });

    cont.appendChild(linea);
  }

  /* lightbox a pantalla completa (con corazón si la foto no existe) */
  function abrirLightbox(src) {
    try {
      let lb = document.getElementById('lightbox');
      if (!lb) {
        lb = document.createElement('div');
        lb.id = 'lightbox';
        lb.className = 'lightbox';
        lb.setAttribute('role', 'dialog');
        lb.setAttribute('aria-modal', 'true');
        lb.addEventListener('click', cerrarLightbox);
        document.addEventListener('keydown', (ev) => {
          if (ev.key === 'Escape') cerrarLightbox();
        });
        document.body.appendChild(lb);
      }

      lb.innerHTML = '';
      lb.classList.add('abierto');

      if (src) {
        const img = new Image();
        img.alt = 'Recuerdo en grande';
        img.addEventListener('error', () => {
          lb.innerHTML = '<div class="lightbox-error">' +
            '<span class="sprite-corazon" aria-hidden="true"></span>' +
            '<p class="pronto">Pronto habrá una foto aquí</p></div>';
        });
        lb.appendChild(img);
        img.src = src;
      } else {
        lb.innerHTML = '<div class="lightbox-error">' +
          '<span class="sprite-corazon" aria-hidden="true"></span>' +
          '<p class="pronto">Pronto habrá una foto aquí</p></div>';
      }

      const pista = document.createElement('p');
      pista.className = 'lightbox-hint';
      pista.textContent = 'Toca en cualquier lado para cerrar';
      lb.appendChild(pista);
    } catch (e) { /* ignorar */ }
  }

  function cerrarLightbox() {
    const lb = document.getElementById('lightbox');
    if (lb) {
      lb.classList.remove('abierto');
      lb.innerHTML = '';
    }
  }

  /* ==================================================================
     15. SECCIÓN RAZONES (19 cartas que se voltean con animación 3D)
     ================================================================== */
  function renderRazones(cont) {
    if (!RAZONES.length) {
      mensajeVacio(cont, 'Las razones aún se están escribiendo...');
      return;
    }

    const total = RAZONES.length;
    const contador = document.createElement('p');
    contador.className = 'contador-cartas';
    contador.setAttribute('role', 'status');

    function actualizarContador() {
      const descubiertas = Math.min(estado.cartas.size, total);
      contador.textContent = descubiertas + '/' + total + ' descubiertas';
    }

    const grilla = document.createElement('div');
    grilla.className = 'grilla-cartas';

    RAZONES.forEach((texto, i) => {
      const carta = document.createElement('button');
      carta.type = 'button';
      carta.className = 'carta';
      carta.setAttribute('aria-label', 'Descubrir la razón número ' + (i + 1));
      carta.innerHTML =
        '<span class="carta-inner">' +
          '<span class="cara cara-reverso">' +
            '<span class="sprite-corazon mini" aria-hidden="true"></span>' +
            '<span class="num">' + pad(i + 1) + '</span>' +
          '</span>' +
          '<span class="cara cara-frente">' +
            '<span class="razon">' + esc(texto) + '</span>' +
          '</span>' +
        '</span>';

      /* cartas ya descubiertas en visitas anteriores */
      if (estado.cartas.has(i)) carta.classList.add('volteada');

      carta.addEventListener('click', () => {
        if (carta.classList.contains('volteada')) return;
        carta.classList.add('volteada');
        carta.setAttribute('aria-label', 'Razón número ' + (i + 1));
        estado.cartas.add(i);
        escribirAlmacen(CLAVES.CARTAS, Array.from(estado.cartas));
        bip(700 + i * 12, 0.06, 'square', 0.05);
        actualizarContador();
      });

      grilla.appendChild(carta);
    });

    actualizarContador();
    cont.appendChild(contador);
    cont.appendChild(grilla);
  }

  /* ==================================================================
     16. SECCIÓN DISTANCIA (haversine + avioncito pixel + encuentro)
     ================================================================== */
  function renderDistancia(cont) {
    const ciudadEl   = DISTANCIA.ciudadEl || {};
    const ciudadElla = DISTANCIA.ciudadElla || {};

    /* distancia en km (haversine); si faltan datos se degrada bonito */
    let km = NaN;
    try {
      km = haversineKm(
        Number(ciudadEl.lat), Number(ciudadEl.lon),
        Number(ciudadElla.lat), Number(ciudadElla.lon)
      );
    } catch (e) { km = NaN; }

    const textoKm = isFinite(km)
      ? '≈ ' + Math.round(km) + ' KM ENTRE NOSOTROS'
      : 'LA DISTANCIA NO SE MIDE';

    /* cuenta regresiva hasta el próximo encuentro (o "Pronto") */
    let valorEncuentro = 'Pronto';
    let etiquetaEncuentro = 'Próximo encuentro';
    if (DISTANCIA.proximoEncuentro) {
      try {
        const fecha = new Date(String(DISTANCIA.proximoEncuentro) + 'T00:00:00');
        if (!isNaN(fecha.getTime())) {
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          const dias = Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
          if (dias <= 0)      valorEncuentro = '¡HOY!';
          else if (dias === 1) valorEncuentro = 'FALTA 1 DÍA';
          else                valorEncuentro = 'FALTAN ' + dias + ' DÍAS';
          etiquetaEncuentro = 'Próximo encuentro: ' +
            (DISTANCIA.proximoEncuentroTexto || fechaES(DISTANCIA.proximoEncuentro));
        }
      } catch (e) { /* queda "Pronto" */ }
    }

    const caja = document.createElement('div');
    caja.className = 'distancia';
    caja.innerHTML =
      '<div class="distancia-caja">' +
        '<div class="nodo-ciudad">' +
          '<span class="sprite-corazon mini" aria-hidden="true"></span>' +
          '<span class="ciudad-nombre">' + esc(ciudadEl.nombre || 'Mi ciudad') + '</span>' +
        '</div>' +
        '<div class="ruta" aria-hidden="true">' +
          '<div class="ruta-linea"></div>' +
          '<div class="sprite-avion"></div>' +
        '</div>' +
        '<div class="nodo-ciudad">' +
          '<span class="sprite-corazon mini" aria-hidden="true"></span>' +
          '<span class="ciudad-nombre">' + esc(ciudadElla.nombre || 'Tu ciudad') + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="distancia-km">' + esc(textoKm) + '</p>' +
      '<p class="frase-distancia">«La distancia no es nada comparado con lo que siento»</p>' +
      '<div class="encuentro">' +
        '<p class="encuentro-etiqueta">' + esc(etiquetaEncuentro) + '</p>' +
        '<p class="encuentro-valor">' + esc(valorEncuentro) + '</p>' +
      '</div>';

    cont.appendChild(caja);
  }

  /* ==================================================================
     17. SECCIÓN MEDIA (casetes / gameboys con botón play pixel)
        - si un archivo falla: el botón se cambia por "pronto"
        - al reproducir, la música de fondo baja; al pausar/terminar sube
     ================================================================== */
  /* galería de fotos (grilla de polaroids con lightbox) */
  function renderGaleria(cont, fotos) {
    const grilla = document.createElement('div');
    grilla.className = 'galeria';
    fotos.forEach((f) => {
      const datos = typeof f === 'string' ? { foto: f } : (f || {});
      if (!datos.foto) return;
      const pol = document.createElement('button');
      pol.type = 'button';
      pol.className = 'polaroid galeria-item';
      pol.setAttribute('aria-label', 'Ver foto: ' + (datos.pie || 'recuerdo'));
      const ventana = document.createElement('div');
      ventana.className = 'polaroid-ventana';
      const img = new Image();
      img.alt = datos.pie || 'Recuerdo';
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        ventana.classList.add('polaroid-error');
        ventana.innerHTML = '<span class="sprite-corazon medio" aria-hidden="true"></span>';
      });
      const pie = document.createElement('span');
      pie.className = 'polaroid-pie';
      pie.textContent = datos.pie || '';
      ventana.appendChild(img);
      pol.appendChild(ventana);
      pol.appendChild(pie);
      pol.addEventListener('click', () => abrirLightbox(datos.foto));
      grilla.appendChild(pol);
      img.src = datos.foto;
    });
    cont.appendChild(grilla);
  }

  /* ==================================================================
     NUESTRAS CANCIONES: tarjeta por canción con la razón + Spotify
       - con link de Spotify: reproductor incrustado (30 s sin sesión;
         desde ahí puede abrirla completa en la app)
       - sin link: botón que abre la búsqueda en Spotify
     ================================================================== */
  function embedSpotify(url) {
    const m = String(url || '').match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist)\/([A-Za-z0-9]+)/);
    return m ? 'https://open.spotify.com/embed/' + m[1] + '/' + m[2] + '?utm_source=generator&theme=0' : '';
  }

  function renderCanciones(cont) {
    const CANCIONES = Array.isArray(CONTENIDO.canciones) ? CONTENIDO.canciones : [];
    if (!CANCIONES.length) {
      mensajeVacio(cont, 'Aquí sonará nuestra música muy pronto...');
      return;
    }
    const intro = document.createElement('p');
    intro.className = 'canciones-intro';
    intro.textContent = 'Cada una de estas canciones me recuerda a ti. Dale play y escúchalas pensando en nosotros.';
    cont.appendChild(intro);

    const lista = document.createElement('div');
    lista.className = 'lista-canciones';
    CANCIONES.forEach((c, i) => {
      const d = c || {};
      const tarjeta = document.createElement('article');
      tarjeta.className = 'cancion';
      tarjeta.innerHTML =
        '<p class="cancion-num">Pista ' + pad(i + 1) + '</p>' +
        '<h3 class="cancion-titulo">♪ ' + esc(d.titulo || '') + '</h3>' +
        (d.artista ? '<p class="cancion-artista">' + esc(d.artista) + '</p>' : '') +
        '<p class="cancion-razon">' + esc(d.razon || '') + '</p>';

      const src = embedSpotify(d.spotify);
      const yt = String(d.youtube || '').match(/^[A-Za-z0-9_-]{11}$/) ? d.youtube : '';
      if (yt) {
        /* YouTube: canción completa dentro de la página */
        const marco = document.createElement('div');
        marco.className = 'cancion-video';
        const iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube-nocookie.com/embed/' + yt + '?rel=0&playsinline=1';
        iframe.loading = 'lazy';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.allowFullscreen = true;
        iframe.title = 'YouTube: ' + (d.titulo || '');
        iframe.addEventListener('mouseenter', pausarFondo);
        iframe.addEventListener('touchstart', pausarFondo, { passive: true });
        marco.appendChild(iframe);
        tarjeta.appendChild(marco);
      } else if (src) {
        const iframe = document.createElement('iframe');
        iframe.className = 'cancion-embed';
        iframe.src = src;
        iframe.height = '80';
        iframe.loading = 'lazy';
        iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
        iframe.title = 'Spotify: ' + (d.titulo || '');
        /* al tocar el reproductor, pausamos la música de fondo */
        iframe.addEventListener('mouseenter', pausarFondo);
        iframe.addEventListener('touchstart', pausarFondo, { passive: true });
        tarjeta.appendChild(iframe);
      } else {
        const a = document.createElement('a');
        a.className = 'btn-pixel btn-spotify';
        a.href = 'https://open.spotify.com/search/' + encodeURIComponent((d.titulo || '') + ' ' + (d.artista || ''));
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Escuchar en Spotify';
        a.addEventListener('click', pausarFondo);
        tarjeta.appendChild(a);
      }
      lista.appendChild(tarjeta);
    });
    cont.appendChild(lista);
  }

  function pausarFondo() {
    try { if (estado.musica && !estado.musica.paused) estado.musica.pause(); } catch (e) { /* ignorar */ }
  }

  /* botón "Escuchar nuestra canción" bajo el menú (enlace a Spotify/YouTube) */
  function agregarBotonCancion() {
    const enlace = CONTENIDO.cancion && CONTENIDO.cancion.enlace;
    const menu = document.getElementById('menu-rpg');
    if (!enlace || !menu || document.getElementById('btn-cancion')) return;
    const a = document.createElement('a');
    a.id = 'btn-cancion';
    a.className = 'btn-menu btn-cancion';
    a.href = enlace;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = '♪ Nuestra canción: ' + (CONTENIDO.cancion.titulo || '');
    a.addEventListener('click', () => {
      /* pausa la música de fondo para que no se mezcle */
      try { if (estado.musica) estado.musica.pause(); } catch (e) { /* ignorar */ }
    });
    menu.appendChild(a);
  }

  function renderMedia(cont) {
    const GALERIA = Array.isArray(CONTENIDO.galeria) ? CONTENIDO.galeria : [];
    if (!LISTA_MEDIA.length && GALERIA.length) {
      renderGaleria(cont, GALERIA);
      return;
    }
    if (!LISTA_MEDIA.length) {
      mensajeVacio(cont, 'Aquí habrá mensajes muy pronto...');
      return;
    }

    estado.medios = [];
    const lista = document.createElement('div');
    lista.className = 'lista-media';

    LISTA_MEDIA.forEach((item, i) => {
      const datos = item || {};
      const esVideo = datos.tipo === 'video';
      const player = document.createElement('article');
      player.className = 'player';

      const titulo = document.createElement('p');
      titulo.className = 'player-titulo';
      titulo.textContent = datos.titulo || (esVideo ? 'Video ' : 'Mensaje ') + (i + 1);
      player.appendChild(titulo);

      /* ---- marco reproductor según el tipo ---- */
      let marco = null;
      let medio = null;
      let progresoFill = null;
      let nodoTiempo = null;

      if (esVideo) {
        /* consola gameboy con la "pantalla" arriba */
        marco = document.createElement('div');
        marco.className = 'gameboy';
        const pantalla = document.createElement('div');
        pantalla.className = 'gameboy-pantalla';
        medio = document.createElement('video');
        medio.preload = 'metadata';
        medio.setAttribute('playsinline', '');
        medio.playsInline = true;
        pantalla.appendChild(medio);
        marco.appendChild(pantalla);
      } else {
        /* casete con dos bobinas pixel */
        marco = document.createElement('div');
        marco.className = 'casetera';
        marco.innerHTML =
          '<div class="casete">' +
            '<div class="bobina" aria-hidden="true"></div>' +
            '<div class="bobina" aria-hidden="true"></div>' +
            '<span class="etiqueta-casete">LADO A</span>' +
          '</div>';
      }

      /* fila de datos (sólo audio: tiempo transcurrido + barra pixel) */
      if (!esVideo) {
        const filaDatos = document.createElement('div');
        filaDatos.className = 'fila-datos';
        nodoTiempo = document.createElement('span');
        nodoTiempo.className = 'player-tiempo';
        nodoTiempo.textContent = '0:00';
        const progreso = document.createElement('div');
        progreso.className = 'progreso';
        progresoFill = document.createElement('div');
        progresoFill.className = 'progreso-fill';
        progreso.appendChild(progresoFill);
        filaDatos.appendChild(nodoTiempo);
        filaDatos.appendChild(progreso);
        marco.appendChild(filaDatos);
      }

      /* fila de controles: botón play pixel (o "pronto" si el archivo falla) */
      const filaControles = document.createElement('div');
      filaControles.className = 'fila-controles';

      const btnPlay = document.createElement('button');
      btnPlay.type = 'button';
      btnPlay.className = 'btn-pixel btn-play';
      btnPlay.textContent = 'Play';
      filaControles.appendChild(btnPlay);

      const registro = { el: null, roto: false };

      function marcarRoto() {
        registro.roto = true;
        player.classList.add('roto');
        filaControles.innerHTML = '<span class="pronto">Pronto</span>';
      }

      /* el tag <audio> oculto se crea aparte del casete */
      if (!esVideo) {
        medio = document.createElement('audio');
        medio.preload = 'metadata';
        medio.style.display = 'none';
        player.appendChild(medio);
      }
      registro.el = medio;
      estado.medios.push(registro);

      if (!datos.archivo) {
        marcarRoto();
      } else {
        medio.addEventListener('error', () => marcarRoto());

        /* al reproducir: pausa a los demás y baja la música de fondo */
        medio.addEventListener('play', () => {
          estado.medios.forEach((r) => {
            if (r !== registro && r.el && !r.el.paused) {
              try { r.el.pause(); } catch (err) {}
            }
          });
          marco.classList.add('sonando');
          btnPlay.textContent = 'Pausa';
          bajarVolumenMusica();
        });

        /* al pausar/terminar: la música vuelve a su volumen */
        medio.addEventListener('pause', () => {
          marco.classList.remove('sonando');
          btnPlay.textContent = 'Play';
          restaurarVolumenMusica();
        });
        medio.addEventListener('ended', () => {
          marco.classList.remove('sonando');
          btnPlay.textContent = 'Play';
          restaurarVolumenMusica();
        });

        /* barra de progreso y tiempo (sólo audio) */
        if (!esVideo) {
          medio.addEventListener('timeupdate', () => {
            try {
              const dur = medio.duration;
              if (isFinite(dur) && dur > 0 && progresoFill) {
                progresoFill.style.width = ((medio.currentTime / dur) * 100).toFixed(1) + '%';
              }
              if (nodoTiempo) nodoTiempo.textContent = formatoTiempo(medio.currentTime);
            } catch (err) {}
          });
        }

        btnPlay.addEventListener('click', () => {
          if (registro.roto || !medio) return;
          try {
            if (medio.paused) {
              const promesa = medio.play();
              if (promesa && typeof promesa.catch === 'function') {
                promesa.catch(() => marcarRoto());
              }
            } else {
              medio.pause();
            }
          } catch (err) {
            marcarRoto();
          }
        });

        player.appendChild(marco);
        player.appendChild(filaControles);
        medio.src = datos.archivo; /* listeners primero, src después */
      }

      /* si es roto desde el inicio, igual añadimos el marco atenuado */
      if (registro.roto) {
        player.appendChild(marco);
        if (!filaControles.parentNode) player.appendChild(filaControles);
      }

      lista.appendChild(player);
    });

    cont.appendChild(lista);
  }

  /* pausa todos los mensajes (al salir de la sección) */
  function pausarMedios() {
    estado.medios.forEach((r) => {
      if (r.el && !r.el.paused) {
        try { r.el.pause(); } catch (e) {}
      }
    });
    restaurarVolumenMusica();
  }

  /* ==================================================================
     18. SECCIÓN CUPONES (vales troquelados + sello CANJEADO)
     ================================================================== */
  function renderCupones(cont) {
    if (!CUPONES.length) {
      mensajeVacio(cont, 'Los vales se están imprimiendo...');
      return;
    }

    const envoltura = document.createElement('div');
    envoltura.className = 'lista-tickets';

    CUPONES.forEach((texto, i) => {
      const yaCanjeado = estado.canjeados.has(i);
      const ticket = document.createElement('article');
      ticket.className = 'ticket' + (yaCanjeado ? ' canjeado' : '');

      const num = document.createElement('p');
      num.className = 'ticket-num';
      num.textContent = 'Vale Nº ' + pad(i + 1);

      const cuerpo = document.createElement('p');
      cuerpo.className = 'ticket-texto';
      cuerpo.textContent = texto;

      const sello = document.createElement('div');
      sello.className = 'ticket-sello';
      sello.textContent = 'Canjeado';

      if (!yaCanjeado) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'btn-pixel rojo btn-canjear';
        boton.textContent = 'Canjear';
        boton.addEventListener('click', () => canjear(ticket, i));
        ticket.appendChild(boton);
      }

      ticket.appendChild(num);
      ticket.appendChild(cuerpo);
      ticket.appendChild(sello);
      envoltura.appendChild(ticket);
    });

    cont.appendChild(envoltura);
  }

  function canjear(ticket, i) {
    if (estado.canjeados.has(i)) return;
    estado.canjeados.add(i);
    escribirAlmacen(CLAVES.CUPONES, Array.from(estado.canjeados));

    ticket.classList.add('canjeado');
    const boton = ticket.querySelector('.btn-canjear');
    if (boton) boton.remove();

    bip(392, 0.06, 'square', 0.06);
    setTimeout(() => bip(587, 0.1, 'square', 0.06), 90);
    avisar('¡Vale canjeado! Guárdalo para vernos', 2600);
  }

  /* ==================================================================
     19. SECCIÓN CARTA (pastel pixel + 19 velas + soplar + typewriter)
     ================================================================== */
  function renderCarta(cont) {
    const zona = document.createElement('div');
    zona.className = 'carta-pastel-zona';

    const pastel = document.createElement('div');
    pastel.className = 'pastel';
    pastel.setAttribute('role', 'img');
    pastel.setAttribute('aria-label', 'Pastel de cumpleaños con ' + EDAD + ' velas encendidas');

    /* fila de velas (una por año) */
    const capaVelas = document.createElement('div');
    capaVelas.className = 'capa-velas';
    for (let i = 0; i < EDAD; i++) {
      const vela = document.createElement('div');
      vela.className = 'vela';
      const llama = document.createElement('div');
      llama.className = 'llama';
      llama.setAttribute('aria-hidden', 'true');
      vela.appendChild(llama);
      capaVelas.appendChild(vela);
    }

    pastel.appendChild(capaVelas);

    /* pisos del pastel (glaseado pixel vía CSS) */
    ['piso-arriba', 'piso-medio', 'piso-abajo'].forEach((clasePiso) => {
      const piso = document.createElement('div');
      piso.className = 'pastel-piso ' + clasePiso;
      pastel.appendChild(piso);
    });
    const plato = document.createElement('div');
    plato.className = 'pastel-plato';
    pastel.appendChild(plato);

    const instruccion = document.createElement('p');
    instruccion.className = 'carta-instruccion';
    instruccion.textContent = 'Pide un deseo y sopla las velas';

    /* botones de soplido (normal y con micrófono) */
    const zonaBotones = document.createElement('div');
    zonaBotones.className = 'soplar-zona';

    const btnSoplar = document.createElement('button');
    btnSoplar.type = 'button';
    btnSoplar.id = 'btn-soplar';
    btnSoplar.className = 'btn-pixel';
    btnSoplar.textContent = 'Soplar';

    const btnMicro = document.createElement('button');
    btnMicro.type = 'button';
    btnMicro.id = 'btn-micro';
    btnMicro.className = 'btn-pixel violeta';
    btnMicro.textContent = 'Soplar al micro';

    zonaBotones.appendChild(btnSoplar);
    zonaBotones.appendChild(btnMicro);

    /* medidor del micrófono (aparece al escuchar) */
    const medidor = document.createElement('div');
    medidor.id = 'medidor-mic';
    medidor.className = 'medidor-mic';
    medidor.hidden = true;
    const medidorFill = document.createElement('div');
    medidorFill.id = 'medidor-fill';
    medidorFill.className = 'medidor-fill';
    medidor.appendChild(medidorFill);

    /* la carta en sí (oculta hasta soplar) */
    const carta = document.createElement('article');
    carta.id = 'carta-cont';
    carta.className = 'carta-final';
    carta.hidden = true;
    carta.innerHTML =
      '<p class="carta-titulo">Para ti, ' + esc(NOMBRE_ELLA) + '</p>' +
      '<div id="carta-cuerpo" class="carta-cuerpo"></div>';

    /* botón para repetir el momento */
    const btnReencender = document.createElement('button');
    btnReencender.type = 'button';
    btnReencender.id = 'btn-reencender';
    btnReencender.className = 'btn-pixel amarillo';
    btnReencender.textContent = 'Encender de nuevo';
    btnReencender.hidden = true;

    zona.appendChild(pastel);
    zona.appendChild(instruccion);
    zona.appendChild(zonaBotones);
    zona.appendChild(medidor);
    zona.appendChild(carta);
    zona.appendChild(btnReencender);
    cont.appendChild(zona);

    const velas = $$('.vela', capaVelas);

    /* -------- secuencia de soplado -------- */
    function apagarVelas() {
      estado.soplando = true;
      estado.generacionCarta++; /* cancela escrituras previas */

      /* se apagan una a una, rapidito, con su "puff" */
      velas.forEach((vela, i) => {
        const espera = reduceMotion ? 0 : i * 70;
        setTimeout(() => {
          vela.classList.add('apagada');
          bip(180 + Math.random() * 90, 0.045, 'triangle', 0.05);
        }, espera);
      });

      const finVelas = reduceMotion ? 100 : velas.length * 70 + 250;

      /* al final: fanfarria + confeti y aparece la carta */
      setTimeout(() => {
        try { pastel.setAttribute('aria-label', 'Pastel con las velas apagadas'); } catch (e) {}
        fanfarria();
        lanzarConfeti(130);

        btnSoplar.hidden = true;
        btnMicro.hidden = true;
        medidor.hidden = true;

        carta.hidden = false;
        carta.classList.add('mostrada');
        escribirCartaTabla(carta);

        setTimeout(() => { btnReencender.hidden = false; }, 600);
      }, finVelas);
    }

    function reencender() {
      estado.soplando = false;
      estado.generacionCarta++;
      detenerMicro();

      velas.forEach((vela) => vela.classList.remove('apagada'));
      carta.hidden = true;
      carta.classList.remove('mostrada');
      const cuerpo = document.getElementById('carta-cuerpo');
      if (cuerpo) cuerpo.innerHTML = '';
      btnReencender.hidden = true;
      btnSoplar.hidden = false;
      btnMicro.hidden = false;

      bip(740, 0.06, 'square', 0.05);
    }

    btnSoplar.addEventListener('click', () => {
      if (!estado.soplando) apagarVelas();
    });

    btnMicro.addEventListener('click', () => {
      if (estado.soplando) return;
      if (estado.micro.activo) { detenerMicro(); return; }
      escucharMicrofono();
    });

    btnReencender.addEventListener('click', reencender);
  }

  /* ==================================================================
     20. SOPLAR AL MICRÓFONO (getUserMedia + AnalyserNode)
        Si se niegan los permisos, sólo queda el botón "Soplar".
     ================================================================== */
  async function escucharMicrofono() {
    const btnMicro = document.getElementById('btn-micro');
    const medidor = document.getElementById('medidor-mic');
    const fill = document.getElementById('medidor-fill');

    /* ¿el navegador siquiera lo permite? */
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      avisar('Tu navegador no deja usar el micrófono: toca "Soplar"');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      estado.micro.stream = stream;
      estado.micro.activo = true;

      if (btnMicro) {
        btnMicro.textContent = 'Escuchando...';
        btnMicro.classList.add('parpadeo');
      }
      if (medidor) medidor.hidden = false;

      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('sin AudioContext');
      const ctx = new AC();
      estado.micro.ctx = ctx;
      try { await ctx.resume(); } catch (e) { /* ignorar */ }

      const fuente = ctx.createMediaStreamSource(stream);
      const analizador = ctx.createAnalyser();
      analizador.fftSize = 512;
      analizador.smoothingTimeConstant = 0.6;
      fuente.connect(analizador);

      const datos = new Uint8Array(analizador.fftSize);
      let framesFuertes = 0;

      const UMBRAL = 0.18;      /* volumen RMS que cuenta como soplido */
      const FRAMES_NECESARIOS = 9; /* ~150 ms sostenidos */

      const flujo = () => {
        if (!estado.micro.activo) return;
        try {
          analizador.getByteTimeDomainData(datos);
          let suma = 0;
          for (let i = 0; i < datos.length; i++) {
            const val = (datos[i] - 128) / 128;
            suma += val * val;
          }
          const rms = Math.sqrt(suma / datos.length);
          if (fill) fill.style.width = Math.min(100, rms * 300).toFixed(0) + '%';

          if (rms > UMBRAL) framesFuertes++;
          else framesFuertes = Math.max(0, framesFuertes - 2);

          if (framesFuertes >= FRAMES_NECESARIOS) {
            detenerMicro();
            const btnSoplar = document.getElementById('btn-soplar');
            if (btnSoplar && !btnSoplar.hidden) btnSoplar.click(); /* ¡sopla! */
            return;
          }
        } catch (e) { /* ignorar un frame porido */ }
        estado.micro.raf = requestAnimationFrame(flujo);
      };
      flujo();
    } catch (e) {
      /* permiso denegado o sin micrófono: sólo queda el botón Soplar */
      avisar('No pude escucharte; toca el botón "Soplar"');
      detenerMicro();
    }
  }

  function detenerMicro() {
    const micro = estado.micro;
    micro.activo = false;
    try { cancelAnimationFrame(micro.raf); } catch (e) {}
    if (micro.stream) {
      micro.stream.getTracks().forEach((pista) => {
        try { pista.stop(); } catch (e) {}
      });
      micro.stream = null;
    }
    if (micro.ctx) {
      try { micro.ctx.close(); } catch (e) {}
      micro.ctx = null;
    }
    const btnMicro = document.getElementById('btn-micro');
    if (btnMicro) {
      btnMicro.textContent = 'Soplar al micro';
      btnMicro.classList.remove('parpadeo');
    }
    const medidor = document.getElementById('medidor-mic');
    if (medidor) medidor.hidden = true;
  }

  /* ==================================================================
     21. CARTA CON EFECTO MÁQUINA DE ESCRIBIR (+ firma)
     ================================================================== */
  function escribirCartaTabla(carta) {
    const cuerpo = carta.querySelector('#carta-cuerpo') ||
      document.getElementById('carta-cuerpo');
    if (!cuerpo) return;

    cuerpo.innerHTML = '';
    const generacion = ++estado.generacionCarta;

    const parrafos = CARTA.length ? CARTA : ['Feliz cumpleaños.'];
    const textoFirma = NOMBRE_EL ? '— ' + NOMBRE_EL : '— Con todo mi amor';

    function agregarFirma() {
      if (generacion !== estado.generacionCarta) return;
      const firma = document.createElement('p');
      firma.className = 'firma';
      firma.textContent = textoFirma;
      cuerpo.appendChild(firma);
    }

    /* accesibilidad: sin animación, texto directo */
    if (reduceMotion) {
      parrafos.forEach((t) => {
        const p = document.createElement('p');
        p.textContent = t;
        cuerpo.appendChild(p);
      });
      agregarFirma();
      return;
    }

    const cursor = document.createElement('span');
    cursor.className = 'cursor-escritura';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.style.animation = 'parpadear 1s steps(1, jump-none) infinite';

    let indice = 0;

    function siguienteParrafo() {
      if (generacion !== estado.generacionCarta) return;
      if (indice >= parrafos.length) {
        cursor.remove();
        agregarFirma();
        return;
      }
      const p = document.createElement('p');
      cuerpo.appendChild(p);
      p.appendChild(cursor);
      const texto = String(parrafos[indice++]);
      let pos = 0;

      function tic() {
        if (generacion !== estado.generacionCarta) return;
        if (pos < texto.length) {
          p.insertBefore(document.createTextNode(texto[pos]), cursor);
          pos++;
          if (pos % 7 === 0) bip(880, 0.012, 'square', 0.015); /* tecleo */
          setTimeout(tic, 24 + Math.random() * 22);
        } else {
          setTimeout(siguienteParrafo, 340);
        }
      }
      tic();
    }

    siguienteParrafo();
  }

  /* ==================================================================
     22. TABLA DE RENDERIZADORES POR SECCIÓN
     ================================================================== */
  const RENDERIZADORES = {
    'sec-recuerdos': renderRecuerdos,
    'sec-razones':   renderRazones,
    'sec-distancia': renderDistancia,
    'sec-media':     renderMedia,
    'sec-canciones': renderCanciones,
    'sec-cupones':   renderCupones,
    'sec-carta':     renderCarta
  };

  /* ==================================================================
     23. ARRANQUE DE LA APP
     ================================================================== */
  function iniciarAplicacion() {
    try {
      /* cielo de estrellas detrás de todo */
      crearEstrellas();

      /* música de fondo (si la canción existe) */
      prepararMusica();

      /* botón PRESS START */
      const btnStart = document.getElementById('btn-start');
      if (btnStart) btnStart.addEventListener('click', comenzarExperiencia);

      /* botones del menú tipo RPG (delegación en el nav) */
      const menu = document.getElementById('menu-rpg');
      if (menu) {
        menu.addEventListener('click', (ev) => {
          const objetivo = ev.target.closest('.btn-menu');
          if (objetivo) {
            const id = objetivo.getAttribute('data-seccion');
            if (id) abrirSeccion(id);
          }
        });
      }

      /* decide la pantalla inicial: cuenta atrás (bloqueo) o inicio */
      iniciarBloqueo();
    } catch (e) {
      /* si algo falla de raíz, al menos se ve la pantalla de inicio */
      try { irAInicio(); } catch (e2) { /* nada más que hacer */ }
    }
  }

  /* app.js se carga al final del <body>, pero por si acaso */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarAplicacion);
  } else {
    iniciarAplicacion();
  }
})();
