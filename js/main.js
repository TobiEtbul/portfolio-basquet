/* Portfolio · Tobías Etbul
 * Un solo escenario de 1440x900 y un solo "reloj": u = scrollY / alto de ventana.
 * render(u) calcula TODO a partir de u, así que al scrollear hacia arriba se deshace cada paso.
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (u, a, b) => clamp((u - a) / (b - a));
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- fases (en alturas de ventana de scroll) ---------- */
  const P = {
    dribble: [0, 2.4],      // pica la pelota: aparece TOBIAS y después ETBUL
    shot:    [2.4, 3.4],    // se prepara y tira · entra el celeste desde abajo
    horiz:   [3.4, 9.4],    // línea de tiempo de costado · la pelota viaja hasta el aro
    drop:    [9.4, 10.4],   // la pelota cae por el aro · sube el póster
    read:    [10.4, 12.0],  // lee las estadísticas · gira la pelota
    pass:    [12.0, 13.6],  // el pase
    toMid:   [13.6, 14.4],  // la pelota va al medio
    zoom:    [14.4, 15.6],  // la pelota ocupa toda la pantalla
    contact: [15.0, 15.8],  // aparece el contacto
    end: 16
  };

  /* ---------- constantes de diseño (Figma, 1440x900) ---------- */
  const BALL = { cx: 765, cy: 495, D: 962 };            // pelota dentro de su imagen de 1536x1024
  const SEQ  = { w: 247, h: 245, k: 1.55, left: -30, top: 530, ball11: [47.809, 7.194, 34] };
  const SEQ_N = 16;
  const PASE = { left: 1084, top: 657, sx: 353 / 384, sy: 235 / 256, n: 16 };
  const TRACK_MAX = 2880;                               // cuánto se corre la línea de tiempo
  const HOOP_X0 = 2880 + 1206;                          // posición del aro en la línea de tiempo
  const RIM_X = 1311;                                   // centro del aro cuando queda fijo

  const stage = $('#stage'), intro = $('#intro'), time = $('#time'), poster = $('#poster'),
        track = $('#track'), char = $('#char'), pase = $('#pase'), hoop = $('#hoop'),
        ball = $('#ball'), contact = $('#contact'), tTobias = $('#t-tobias'), tEtbul = $('#t-etbul'),
        spacer = $('#spacer'), loader = $('#loader'), loaderTxt = $('#loader-txt');

  /* ---------- frames ---------- */
  const two = n => String(n).padStart(2, '0');
  function stack(host, folder, names, w, h) {
    const map = {};
    names.forEach(n => {
      const im = new Image(); im.src = `assets/${folder}/${n}.webp`; im.alt = ''; im.decoding = 'async';
      host.appendChild(im); map[n] = im;
    });
    return map;
  }
  const seqNames = Array.from({ length: SEQ_N }, (_, i) => two(i));
  const paseNames = [...Array.from({ length: PASE.n }, (_, i) => two(i)), '0b', '15b'];
  Object.assign(char.style, { left: SEQ.left + 'px', top: SEQ.top + 'px', width: SEQ.w * SEQ.k + 'px', height: SEQ.h * SEQ.k + 'px' });
  const seqImgs = stack(char, 'seq', seqNames);
  const paseImgs = stack(pase, 'pase', paseNames);
  let seqOn = null, paseOn = null;
  const show = (map, key, cur) => { if (cur === key) return cur; if (cur) map[cur].classList.remove('on'); map[key].classList.add('on'); return key; };

  /* ---------- seguimiento de la pelota del giro/pase (espejado, igual que el Figma) ---------- */
  const trk = [{"cx": 127.46, "cy": 51.93, "w": 86, "h": 92}, {"cx": 131.1, "cy": 49.43, "w": 84, "h": 82}, {"cx": 134.12, "cy": 47.81, "w": 82, "h": 79}, {"cx": 132.71, "cy": 45.99, "w": 82, "h": 77}, {"cx": 128.43, "cy": 42.17, "w": 81, "h": 76}, {"cx": 129.84, "cy": 59.29, "w": 79, "h": 76}, {"cx": 130.19, "cy": 96.15, "w": 81, "h": 78}, {"cx": 130.16, "cy": 127.48, "w": 86, "h": 86}, {"cx": 145.67, "cy": 132.08, "w": 80, "h": 82}, {"cx": 124.64, "cy": 126.28, "w": 85, "h": 87}, {"cx": 150.86, "cy": 122.84, "w": 88, "h": 88}, {"cx": 117.09, "cy": 135.58, "w": 98, "h": 91}, {"cx": 90.13, "cy": 134.73, "w": 85, "h": 79}, {"cx": 117.6, "cy": 116.18, "w": 113, "h": 101}, {"cx": 106.98, "cy": 107.76, "w": 137, "h": 136}, {"cx": 105.14, "cy": 111.25, "w": 149, "h": 144}];   // pelota del giro/pase detectada en cada frame (coordenadas del gif original 384x256)
  const paseBall = i => {
    const b = trk[i];
    return { x: PASE.left + (384 - b.cx) * PASE.sx, y: PASE.top + b.cy * PASE.sy, d: ((b.w + b.h) / 2) * PASE.sx };
  };

  /* ---------- trayecto de la pelota en la línea de tiempo ---------- */
  const BX = SEQ.left + (SEQ.w - SEQ.ball11[0]) * SEQ.k;     // sale de la mano (frame 11, espejado)
  const BY = SEQ.top + SEQ.ball11[1] * SEQ.k;
  const BD = SEQ.ball11[2] * SEQ.k;
  const END_Y = 385;                                          // justo arriba del aro
  const PTS = [[BX, BY], [520, 150], [993, 67], [1993, 67], [2443, 63], [3174, 93], [3555, 157], [4083, 286], [HOOP_X0 + RIM_X - 1206, END_Y]];
  const TX_END = PTS[PTS.length - 1][0];
  const slopes = PTS.map((p, i) => {
    const a = PTS[Math.max(0, i - 1)], b = PTS[Math.min(PTS.length - 1, i + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  });
  function pathY(x) {
    let i = 0; while (i < PTS.length - 2 && x > PTS[i + 1][0]) i++;
    const [x0, y0] = PTS[i], [x1, y1] = PTS[i + 1], h = x1 - x0, t = clamp((x - x0) / h);
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * slopes[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * slopes[i + 1];
  }

  /* ---------- ajuste a la ventana ---------- */
  let S = 1, OX = 0, OY = 0, EX = 0, EY = 0, VH = innerHeight, BOT = 900;
  function fit() {
    const vw = innerWidth, vh = innerHeight, sW = vw / 1440, sH = vh / 900;
    const ratio = Math.max(sW, sH) / Math.min(sW, sH);
    S = ratio <= 1.07 ? Math.max(sW, sH) : Math.min(sW, sH);   // casi 16:10 → llena la pantalla; más ancha (16:9) → entra entera y los fondos se estiran
    OX = (vw - 1440 * S) / 2; OY = (vh - 900 * S) / 2; VH = vh;
    EX = Math.max(0, OX / S); EY = Math.max(0, OY / S);
    BOT = (vh - OY) / S + EY + 120;                            // abajo de todo (con margen), para que los paneles entren desde afuera
    stage.style.transform = `translate3d(${OX}px,${OY}px,0) scale(${S})`;
    stage.style.setProperty('--ex', EX + 'px'); stage.style.setProperty('--ey', EY + 'px');
    spacer.style.height = (P.end + 1) * vh + 'px';
  }

  const setBall = (cx, cy, d, rot = 0, op = 1) => {
    const s = d / BALL.D;
    ball.style.opacity = op;
    ball.style.transform = `translate3d(${cx}px,${cy}px,0) rotate(${rot}deg) scale(${s}) translate3d(${-BALL.cx}px,${-BALL.cy}px,0)`;
  };

  /* ---------- el reloj ---------- */
  let loopI = 0, frozen = null;
  const LOOP = ['00', '01', '02', '01'];

  function render(u) {
    /* jugador: pique → tiro → follow-through */
    const h = seg(u, P.horiz[0], P.horiz[1]);
    let f;
    if (u < P.shot[0]) f = Math.min(7, Math.floor(8 * seg(u, 0, P.dribble[1])));
    else if (u < P.shot[1]) f = 7 + Math.floor(4 * seg(u, P.shot[0], P.shot[1]));
    else f = 11 + Math.min(4, Math.floor(5 * seg(h, 0, .15)));
    seqOn = show(seqImgs, two(f), seqOn);

    /* intro: nombre aparece en el 1er pique, apellido en el 2do (se deshace al volver) */
    tTobias.classList.toggle('on', u < P.shot[0] && f >= 2);
    tEtbul.classList.toggle('on', u < P.shot[0] && f >= 6);

    /* paneles que entran desde abajo */
    const eT = ease(seg(u, P.shot[0], P.shot[1]));
    time.style.transform = `translate3d(0,${lerp(BOT, 0, eT)}px,0)`;
    time.style.visibility = eT > 0 ? 'visible' : 'hidden';
    const eP = ease(seg(u, P.drop[0], P.drop[1]));
    poster.style.transform = `translate3d(0,${lerp(BOT, 0, eP)}px,0)`;
    poster.style.visibility = eP > 0 ? 'visible' : 'hidden';

    /* línea de tiempo + aro */
    track.style.transform = `translate3d(${-TRACK_MAX * h}px,0,0)`;
    char.style.transform = `translate3d(${-TRACK_MAX * h}px,0,0) scaleX(-1)`;   // el jugador sale con la línea de tiempo
    hoop.style.transform = `translate3d(${HOOP_X0 - TRACK_MAX * h}px,0,0)`;
    hoop.style.opacity = 1 - seg(u, P.pass[1], P.pass[1] + .4);

    /* giro y pase del póster */
    let pk;
    if (u < P.read[0]) pk = '0b';                       // la pelota de la página cae sobre este frame
    else if (u < P.pass[0]) pk = frozen != null ? '00' : LOOP[loopI];
    else if (u < P.pass[1]) pk = two(3 + Math.floor(12 * seg(u, P.pass[0], P.pass[1])));
    else pk = '15b';                                    // la pelota la lleva la página
    paseOn = show(paseImgs, pk, paseOn);

    /* la pelota */
    if (u < P.horiz[0]) setBall(0, 0, 1, 0, 0);
    else if (u < P.horiz[1]) {
      const tx = lerp(BX, TX_END, h);
      const d = lerp(BD, 118, 1 - Math.pow(1 - seg(tx, BX, 700), 3));
      setBall(tx - TRACK_MAX * h, pathY(tx), d, tx * 0.12);
    } else if (u < P.drop[1]) {
      const t = seg(u, P.drop[0], P.drop[1]), hand = paseBall(0);
      setBall(lerp(RIM_X, hand.x, t), lerp(END_Y, hand.y, t * t), lerp(118, hand.d, t), 400 * t + TX_END * 0.12);
    } else if (u < P.pass[1]) setBall(0, 0, 1, 0, 0);
    else if (u < P.toMid[1]) {
      const t = ease(seg(u, P.toMid[0], P.toMid[1])), b = paseBall(15);
      setBall(lerp(b.x, 736.5, t), lerp(b.y, 434.5, t), lerp(b.d * 1.08, BALL.D * 773 / 1536, t), 30 * t);
    } else {
      const k = ease(seg(u, P.zoom[0], P.zoom[1])), w0 = 773, w1 = 12287;
      const w = w0 * Math.pow(w1 / w0, k), q = (w - w0) / (w1 - w0);
      setBall(lerp(736.5, 1732.5, q), lerp(434.5, -0.5, q), BALL.D * w / 1536, 30);
    }

    /* contacto */
    const c = seg(u, P.contact[0], P.contact[1]);
    contact.style.opacity = c; contact.classList.toggle('on', c > .85);
  }

  /* ---------- arranque ---------- */
  let ticking = false;
  const uNow = () => frozen != null ? frozen : scrollY / VH;
  const frame = () => { ticking = false; render(uNow()); };
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };

  async function boot() {
    const qs = new URLSearchParams(location.search);
    if (qs.has('u')) frozen = parseFloat(qs.get('u'));
    const imgs = [...document.images].filter(i => !i.complete || !i.naturalWidth);
    let done = 0; const total = imgs.length || 1;
    await Promise.all(imgs.map(i => (i.decode ? i.decode() : Promise.resolve()).catch(() => {}).then(() => {
      loaderTxt.textContent = `Cargando… ${Math.round(100 * ++done / total)}%`;
    })));
    if (document.fonts) await document.fonts.ready;
    fit(); render(uNow());
    loader.classList.add('done');
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', () => { const u = scrollY / VH; fit(); if (frozen == null) scrollTo(0, u * VH); queue(); });
    setInterval(() => { loopI = (loopI + 1) % LOOP.length; const u = uNow(); if (u >= P.read[0] && u < P.pass[0]) queue(); }, 130);
    window.__render = u => { frozen = u; render(u); };   // para probar: __render(7.5)
  }
  boot();
})();
