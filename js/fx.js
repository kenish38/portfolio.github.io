// ===== Toques de interação pela página =====
// (a luz que seguia o cursor saiu: era uma camada por cima da página inteira, com mistura de cores, e o Chrome no
// Windows passava a desenhar todos os textos com o serrilhado borrado)
//   os cartões de trabalho com um reflexo de luz que segue o cursor (eles não inclinam mais em 3D: inclinado, o cartão
//   vira uma imagem girada pelo navegador, e o título e a foto saíam moles e serrilhados); no celular e no tablet, sem
//   cursor, o reflexo passa pelos cartões enquanto a página rola
//   o fogo na cor da área que sobe do cartão com o mouse por cima (e passa na frente do cartão de cima)
//   os títulos das seções que se formam do pó quando aparecem na tela (o pó de js/ash.js), uma vez por visita
// Quem pediu menos movimento não vê o reflexo, o fogo nem o pó (os títulos aparecem normalmente).
(function () {
  'use strict';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------- O reflexo dos cartões ----------
  var list = document.querySelector('.media');
  if (list && fine && !reduced) {
    list.addEventListener('pointermove', function (e) {
      var li = e.target.closest && e.target.closest('.media > li');
      if (!li) return;
      var r = li.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      li.classList.add('is-tilting');
      li.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); li.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    });
    list.addEventListener('pointerout', function (e) {
      var li = e.target.closest && e.target.closest('.media > li');
      if (!li || (e.relatedTarget && li.contains(e.relatedTarget))) return;
      li.classList.remove('is-tilting');
    });
  }

  // ---------- No toque: o reflexo passa pelos cartões enquanto a página rola ----------
  // Sem cursor, a luz fica parada a 35% da altura da tela: quando o cartão sobe, ela desce por ele, entrando um pouco
  // inclinada (da esquerda para a direita). Só os cartões à vista são mexidos, uma vez por quadro.
  if (list && !fine && !reduced) {
    // As medidas dos cartões são lidas no evento de rolagem (antes dos quadros, com o layout pronto) e as escritas ficam
    // para o quadro: medir um cartão logo depois de escrever no anterior obrigava o navegador a refazer o estilo a cada
    // cartão, a cada quadro da rolagem.
    var LIGHT = 0.35, ticking = false, seen = null;
    var measure = function () {
      var rs = []; for (var i = 0; i < list.children.length; i++) rs.push(list.children[i].getBoundingClientRect());
      return { vh: window.innerHeight, rs: rs };
    };
    var shineFrame = function () {
      ticking = false;
      var m = seen && seen.rs.length === list.children.length ? seen : measure(), vh = m.vh, L = vh * LIGHT;
      seen = null;
      for (var i = 0; i < list.children.length; i++) {
        var li = list.children[i], r = m.rs[i];
        if (r.bottom < -40 || r.top > vh + 40 || !r.height) { if (li.style.getPropertyValue('--shine')) li.style.setProperty('--shine', ''); continue; }
        var y = (L - r.top) / r.height;              // onde a luz está no cartão: 0 no alto, 1 embaixo
        var shine = Math.max(0, Math.min(1, 1.25 - Math.abs(y - 0.5) * 1.6));
        li.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        li.style.setProperty('--gx', (25 + y * 50).toFixed(1) + '%');
        li.style.setProperty('--shine', shine.toFixed(3));
      }
    };
    var queue = function () { if (!ticking) { ticking = true; requestAnimationFrame(shineFrame); } };
    window.addEventListener('scroll', function () { seen = measure(); queue(); }, { passive: true });
    window.addEventListener('resize', function () { seen = null; queue(); });
    new MutationObserver(queue).observe(list, { childList: true });     // os cartões chegam depois (portfolio.json)
    queue();
  }

  // ---------- O fogo do cartão da área, com o mouse por cima ----------
  // Um fogo estilizado, de jogo, na cor da área: chamas com contorno nítido em três tons (a borda mais escura, o meio na
  // cor e o miolo claro), línguas que sobem se torcendo, faíscas subindo e um brilho leve em volta. Ao passar o mouse, as
  // chamas crescem da borda do cartão com um impulso; ao sair, encolhem de volta para dentro dela. Saem da borda de cima
  // e, mais baixas, dos lados; nada fica em cima do cartão (o fogo é desenhado só fora dele), e o título da seção fica na
  // frente. O canvas fica na frente dos cartões: as chamas passam por cima do cartão de cima, e as de uma fileira mais de
  // baixo ficam na frente das da fileira de cima. Quem desenha é a placa de vídeo (WebGL2, um canvas por cartão aceso, só
  // enquanto o fogo dura); sem ela, um
  // fogo de partículas faz as vezes. Um pontilhado finíssimo no brilho evita faixas no fundo quase preto.
  var section = list && list.closest('.work');
  // O mesmo fogo também queima todos os cartões de uma vez quando uma área é aberta ou se volta para as áreas (HRFire.burn,
  // chamado por js/page.js), no computador e no toque; com o mouse por cima, só no computador.
  if (list && section && !reduced) {
    var SIDE = 34, ABOVE = 150, BELOW = 16, RADIUS = 14;      // a folga do canvas em volta do cartão e o canto dele
    var fires = [], fireRaf = 0, fireLast = 0, t0 = performance.now();
    var rgbOf = function (hex) { var n = parseInt(String(hex || '').trim().slice(1), 16); return isNaN(n) ? [243, 242, 239] : [n >> 16, (n >> 8) & 255, n & 255]; };

    // ----- o fogo desenhado pela placa de vídeo -----
    var VS = '#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';
    var FS = [
      '#version 300 es',
      'precision highp float;',
      'uniform vec2 R;uniform vec4 C;uniform float T,ON,D,RAD,E,X;uniform vec3 K0,K1,K2;out vec4 o;',
      // a forma do fogo: a altura das chamas de cima e o quanto as dos lados saem da borda (px), o tamanho e a velocidade
      // do ruído, o quanto ele se torce, a força da base e onde começam o tom do meio e o miolo claro
      'const float FH=114.0,SW=16.0,NX=20.0,NY=80.0,SPD=95.0,WARP=1.2,BASE=0.35,B1=0.26,B2=0.6,FE=96.0,EB=0.30;',
      'float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
      'float n(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1.0,0.0)),u.x),mix(h(i+vec2(0.0,1.0)),h(i+vec2(1.0,1.0)),u.x),u.y);}',
      'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=0.5;}return v;}',
      'float box(vec2 p,vec2 c,vec2 b,float r){vec2 q=abs(p-c)-b+r;return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r;}',
      'void main(){',
      // o ponto, em px da página, com o y para cima; a distância até a borda do cartão (negativa dentro dele)
      '  vec2 p=gl_FragCoord.xy/D,c=(C.xy+C.zw)*0.5,b=(C.zw-C.xy)*0.5;',
      '  float d=box(p,c,b,RAD);',
      '  if(d<0.0&&E<=0.0){o=vec4(0.0);return;}',
      // O fogo fica preso ao cartão (antes, as chamas de cima passavam da largura dele pelos cantos e o fogo virava um T):
      // em cima, só dentro da largura do cartão, afinando perto dos cantos; nos lados, só línguas finas coladas na borda,
      // no alto, que somem para baixo; no pé, nada.
      '  float inX=smoothstep(C.x-1.0,C.x+30.0,p.x)*(1.0-smoothstep(C.z-30.0,C.z+1.0,p.x));',
      '  float up=clamp((p.y-C.y)/(C.w-C.y),0.0,1.0),top=smoothstep(C.w-24.0,C.w+2.0,p.y);',
      '  float hm=mix(SW*pow(up,3.0)*(1.0-inX),FH*pow(inX,0.7),top)*ON,gy=min(max(d,0.0)/max(hm,1e-3),4.0);',
      // o ruído esticado para cima, subindo e se torcendo: só os picos dele passam da altura, e viram línguas pontudas
      '  vec2 q=vec2(p.x/NX,(p.y-T*SPD)/NY);',
      '  vec2 w=vec2(fbm(q*0.9+vec2(3.1,T*0.25)),fbm(q*0.9+7.7));',
      '  float nz=smoothstep(0.2,0.8,fbm(q+WARP*(w-0.5)));',
      '  float m=smoothstep(3.0,12.0,hm),f=d<0.0?-1.0:mix(-1.0,nz-gy+pow(max(1.0-gy,0.0),5.0)*BASE-0.04,m);',
      '  if(E>0.0){',
      '    float wx=smoothstep(C.x-2.0,C.x+16.0,p.x)*(1.0-smoothstep(C.z-16.0,C.z+2.0,p.x));',
      '    float he=(C.w-C.y+FE)*clamp(ON,0.0,1.15)*E,ge=(p.y-C.y)/max(he,1e-3);',
      '    float fe=nz-ge+pow(max(1.0-ge,0.0),2.0)*EB-0.05;',
      '    f=max(f,mix(-1.0,fe,wx*step(C.y-1.0,p.y)*smoothstep(4.0,40.0,he)));',
      '  }',
      '  float alive=smoothstep(X-10.0,X+26.0,p.x);f=mix(-1.0,f,alive);',
      // três tons com contorno nítido (a largura de 1 pixel de tela; limitada, senão onde a chama some de repente, na
      // beira da largura do cartão, sobrava um fio de 1 pixel subindo)
      '  float aa=clamp(fwidth(f),1e-4,0.08);',
      '  float e0=smoothstep(-aa,aa,f),e1=smoothstep(B1-aa,B1+aa,f),e2=smoothstep(B2-aa,B2+aa,f);',
      // queimando inteiro, o fogo fica mais luminoso: a borda na cor da área (a escura, em cima das fotos, parecia mancha),
      // o meio mais claro e o miolo quase branco
      '  vec3 k0=mix(K0,K1,0.75*E),k1=mix(K1,K2,0.3*E),k2=mix(K2,vec3(1.0),0.5*E);',
      '  vec3 col=mix(mix(k0,k1,e1),k2,e2);float a=e0*mix(0.92,1.0,e1);',
      // o brilho em volta, bem leve
      '  float aura=(1.0-e0)*0.18*min(ON,1.0)*exp(-max(-f,0.0)*5.0)*smoothstep(0.0,4.0,d)*m;',
      '  vec3 rgb=K1*aura;float al=aura;',
      '  rgb=col*a+rgb*(1.0-a);al=a+al*(1.0-a);',
      // as faíscas que sobem acima das chamas
      '  vec2 s=vec2(p.x/24.0,(p.y-T*52.0)/24.0),cell=floor(s);float r=h(cell+11.0);',
      '  s.x+=sin(s.y*1.7+r*6.283)*0.1;',
      '  vec2 fr=fract(s)-(vec2(h(cell+3.1),h(cell+7.7))*0.6+0.2);',
      '  float hy=(p.y-C.w)/140.0;',
      '  float sp=smoothstep(0.1,0.0,length(fr))*step(0.9,r)*min(ON,1.0)*smoothstep(0.05,0.25,hy)*(1.0-smoothstep(0.5,0.9,hy))*inX*alive;',
      '  rgb+=K2*sp;al=min(1.0,al+sp);',
      // um pontilhado finíssimo contra faixas no degradê do brilho
      '  rgb+=(h(gl_FragCoord.xy+fract(T))-0.5)/255.0*al;',
      '  o=vec4(rgb,al);',
      '}'
    ].join('\n');
    var pool = [], noGL = false;
    var glSlot = function () {
      for (var i = 0; i < pool.length; i++) if (!pool[i].busy && !pool[i].lost) { pool[i].busy = true; pool[i].cv.hidden = false; return pool[i]; }
      if (noGL || pool.length >= 10) return null;        // até 10 cartões queimando juntos (o navegador aguenta 16)
      var cv = document.createElement('canvas'), gl = null;
      try { gl = cv.getContext('webgl2', { premultipliedAlpha: true, antialias: false, depth: false, stencil: false }); } catch (e) {}
      if (!gl) { noGL = true; return null; }
      var sh = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
      var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS), pr = gl.createProgram();
      if (!vs || !fs) { noGL = true; return null; }
      gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { noGL = true; return null; }
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // um triângulo que cobre tudo
      var at = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(pr);
      var u = {};
      ['R', 'C', 'T', 'ON', 'D', 'RAD', 'E', 'X', 'K0', 'K1', 'K2'].forEach(function (k) { u[k] = gl.getUniformLocation(pr, k); });
      cv.className = 'acard__fire'; cv.setAttribute('aria-hidden', 'true');
      section.appendChild(cv);
      var slot = { cv: cv, gl: gl, u: u, busy: true, lost: false };
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); slot.lost = true; noGL = true; });
      pool.push(slot);
      return slot;
    };

    // ----- a reserva: o fogo de partículas, sem a placa de vídeo -----
    var sprites = {};
    var sprite = function (hex) {
      if (sprites[hex]) return sprites[hex];
      var c3 = rgbOf(hex), r = c3[0], g = c3[1], b = c3[2];
      var tone = function (k) { return k >= 0 ? [r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k] : [r * (1 + k), g * (1 + k), b * (1 + k)]; };
      var make = function (k, a) {
        var c = document.createElement('canvas'); c.width = c.height = 64;
        var x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32), t = tone(k).map(Math.round).join(',');
        gr.addColorStop(0, 'rgba(' + t + ',' + a + ')'); gr.addColorStop(0.35, 'rgba(' + t + ',' + (a * 0.55) + ')');
        gr.addColorStop(0.7, 'rgba(' + t + ',' + (a * 0.14) + ')'); gr.addColorStop(1, 'rgba(' + t + ',0)');
        x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
        return c;
      };
      return (sprites[hex] = [make(0.7, 1), make(0, 0.9), make(-0.45, 0.7)]);
    };
    var spawn = function (f) {
      // as de cima nascem e ficam dentro da largura do cartão; as dos lados são curtas e coladas na borda
      var p = { life: 0, max: 0.5 + Math.random() * 0.5, r: 13 + Math.random() * 19, seed: Math.random() * 6.283, top: true };
      if (f.engulf && Math.random() < 0.7) {       // queimando inteiro: também por todo o cartão, mais embaixo
        p.x = SIDE + 8 + Math.random() * (f.w - 16); p.y = ABOVE + f.h * (0.25 + Math.pow(Math.random(), 0.6) * 0.75);
        p.vx = (Math.random() - 0.5) * 24; p.vy = -(60 + Math.random() * 110); p.r = 16 + Math.random() * 22;
      } else if (Math.random() < 0.8) {
        p.x = SIDE + 14 + Math.random() * (f.w - 28); p.y = ABOVE + 14 + Math.random() * 10;
        p.vx = (Math.random() - 0.5) * 20; p.vy = -(40 + Math.random() * 75);
      } else {
        var side = Math.random() < 0.5 ? -1 : 1, t = Math.pow(Math.random(), 2.4);
        p.top = false; p.max = 0.3 + Math.random() * 0.25; p.r = 8 + Math.random() * 8;
        p.x = side < 0 ? SIDE + 6 : SIDE + f.w - 6; p.y = ABOVE + 30 + t * (f.h * 0.4);
        p.vx = side * (6 + Math.random() * 8); p.vy = -(30 + Math.random() * 40);
      }
      return p;
    };
    var dots = function (f, now, dt) {
      var c = f.ctx, img = f.img, on = Math.max(0, Math.min(1, f.on));
      f.carry += on > 0.02 ? on * (f.engulf ? 2600 : 1100) * (f.w / 380) * dt : 0;
      while (f.carry >= 1 && f.parts.length < 1400) { f.parts.push(spawn(f)); f.carry -= 1; }
      c.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
      c.clearRect(0, 0, f.w + 2 * SIDE, f.h + ABOVE + BELOW);
      c.globalCompositeOperation = 'lighter';
      for (var j = f.parts.length - 1; j >= 0; j--) {
        var p = f.parts[j];
        p.life += dt / p.max;
        if (p.life >= 1) { f.parts.splice(j, 1); continue; }
        p.vy -= 55 * dt; p.vx *= Math.pow(0.3, dt);
        p.x += (p.vx + Math.sin(p.y * 0.05 + now * 0.006 + p.seed * 0.6) * 30) * dt; p.y += p.vy * dt;
        if (p.top) p.x = Math.max(SIDE + 10, Math.min(SIDE + f.w - 10, p.x));     // nada de fogo para fora pelos cantos
        var k = p.life, grow = k < 0.15 ? 0.65 + k / 0.15 * 0.35 : 1;
        var s = p.r * grow * (1 - 0.72 * k) * (1 + 0.12 * Math.sin(now * 0.02 + p.seed * 3));
        c.globalAlpha = Math.pow(Math.sin(Math.PI * k), 0.7) * 0.34;
        c.drawImage(img[k < 0.22 ? 0 : k < 0.6 ? 1 : 2], p.x - s, p.y - s * 1.5, s * 2, s * 2.9);
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'destination-out';
      if (!f.engulf) {                 // o fogo de passar o mouse fica só fora do cartão
        c.beginPath();
        if (c.roundRect) c.roundRect(SIDE, ABOVE, f.w, f.h, RADIUS); else c.rect(SIDE, ABOVE, f.w, f.h);
        c.fill();
      }
      if (f.front != null) c.fillRect(0, 0, Math.max(0, f.front - f.left), f.h + ABOVE + BELOW);   // atrás da borda do pó, nada
      return f.parts.length > 0;
    };

    // ----- cada cartão aceso -----
    // as três cores da chama a partir da cor da área (a do cartão ou, ao abrir uma área, a dela em todos)
    var paintWith = function (f, hex) {
      var c3 = rgbOf(hex).map(function (v) { return v / 255; });
      f.k1 = c3; f.k0 = c3.map(function (v) { return v * 0.5; }); f.k2 = c3.map(function (v) { return v + (1 - v) * 0.6; });
      if (f.ctx) f.img = sprite(hex);
    };
    var fireOf = function (li, color) {
      for (var i = 0; i < fires.length; i++) if (fires[i].li === li) { if (color) paintWith(fires[i], color); return fires[i]; }
      var hex = color || li.style.getPropertyValue('--c') || '#f3f2ef';
      var f = { li: li, on: 0, v: 0, goal: 0, w: 0, h: 0, dpr: 1, gone: false, lock: 0 };
      paintWith(f, hex);
      f.slot = glSlot();
      if (f.slot) f.cv = f.slot.cv;
      else {
        f.cv = document.createElement('canvas'); f.cv.className = 'acard__fire'; f.cv.setAttribute('aria-hidden', 'true');
        section.appendChild(f.cv);
        f.ctx = f.cv.getContext('2d'); f.parts = []; f.carry = 0; f.img = sprite(hex);
      }
      fires.push(f);
      return f;
    };
    var drop = function (f) { if (f.slot) { f.slot.busy = false; f.cv.hidden = true; } else f.cv.remove(); };
    // o canvas acompanha o cartão (se a grade mudar de lugar, ele vai junto)
    var place = function (f) {
      if (f.gone) return;                    // o cartão saiu da página (virou pó): o fogo fica onde ele estava e apaga
      var sr = section.getBoundingClientRect(), r = f.li.getBoundingClientRect();
      var w = r.width + 2 * SIDE, h = r.height + ABOVE + BELOW, dpr = Math.min(window.devicePixelRatio || 1, f.slot ? 2 : 1.5);
      f.cv.style.left = (r.left - sr.left - SIDE).toFixed(1) + 'px'; f.cv.style.top = (r.top - sr.top - ABOVE).toFixed(1) + 'px';
      f.cv.style.width = w + 'px'; f.cv.style.height = h + 'px'; f.left = r.left - SIDE;
      // O fogo fica na frente dos cartões: as chamas de um cartão passam por cima do cartão de cima (antes ficavam atrás
      // dele). O próprio cartão não é coberto: o fogo de passar o mouse só é desenhado fora dele. E o fogo de uma fileira
      // mais de baixo fica na frente do da fileira de cima (no celular, cada cartão é uma fileira).
      var row = Math.max(0, Math.round(f.li.offsetTop / Math.max(1, f.li.offsetHeight + 12)));
      f.cv.style.zIndex = String(2 + Math.min(row, 20));
      if (f.cv.width !== Math.round(w * dpr) || f.cv.height !== Math.round(h * dpr)) { f.cv.width = Math.round(w * dpr); f.cv.height = Math.round(h * dpr); }
      f.w = r.width; f.h = r.height; f.dpr = f.cv.width / w;
    };
    var paint = function (f, now) {
      var g = f.slot.gl, u = f.slot.u;
      g.viewport(0, 0, f.cv.width, f.cv.height);
      g.uniform2f(u.R, f.w + 2 * SIDE, f.h + ABOVE + BELOW);
      g.uniform4f(u.C, SIDE, BELOW, SIDE + f.w, BELOW + f.h);      // o cartão, com o y para cima
      g.uniform1f(u.T, ((now - t0) / 1000) % 600);
      g.uniform1f(u.ON, Math.max(0, f.on)); g.uniform1f(u.D, f.dpr); g.uniform1f(u.RAD, RADIUS);
      g.uniform1f(u.E, f.engulf ? 1 : 0); g.uniform1f(u.X, f.front == null ? -1e5 : f.front - f.left);
      g.uniform3f(u.K0, f.k0[0], f.k0[1], f.k0[2]); g.uniform3f(u.K1, f.k1[0], f.k1[1], f.k1[2]); g.uniform3f(u.K2, f.k2[0], f.k2[1], f.k2[2]);
      g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };
    var burn = function (now) {
      fireRaf = 0;
      var dt = fireLast ? Math.min(0.05, (now - fireLast) / 1000) : 0.016; fireLast = now;
      for (var i = fires.length - 1; i >= 0; i--) {
        var f = fires[i];
        if (f.slot && f.slot.lost) { drop(f); fires.splice(i, 1); continue; }
        if (!f.li.isConnected) { f.gone = true; f.goal = 0; }
        if (f.li.hrAshFront != null) f.front = f.li.hrAshFront;
        // a mola: acende com um impulso (passa um pouco do tamanho e volta) e apaga encolhendo
        f.v += ((f.goal - f.on) * 90 - f.v * 13) * dt; f.on += f.v * dt;
        if (f.on < 0) { f.on = 0; f.v = 0; }
        place(f);
        var alive = f.slot ? (paint(f, now), true) : dots(f, now, dt);
        if (!f.goal && f.on < 0.004 && Math.abs(f.v) < 0.02 && (f.slot || !alive)) { drop(f); fires.splice(i, 1); }
      }
      if (fires.length) fireRaf = requestAnimationFrame(burn); else fireLast = 0;
    };
    var ignite = function (li, on) {
      var f = on ? fireOf(li) : fires.filter(function (x) { return x.li === li; })[0];
      if (!f || (!on && f.lock > performance.now())) return;     // queimando para virar pó: tirar o mouse não apaga
      f.goal = on ? 1 : 0;
      if (!fireRaf) fireRaf = requestAnimationFrame(burn);
    };
    if (fine) {
      list.addEventListener('pointerover', function (e) {
        var li = e.target.closest && e.target.closest('.media > li');
        if (li && e.pointerType === 'mouse' && !li.classList.contains('is-forming') && !(e.relatedTarget && li.contains(e.relatedTarget))) ignite(li, true);
      });
      list.addEventListener('pointerout', function (e) {
        var li = e.target.closest && e.target.closest('.media > li');
        if (li && !(e.relatedTarget && li.contains(e.relatedTarget))) ignite(li, false);
      });
    }
    // Todos os cartões pegam fogo juntos por ms milissegundos, cada um na própria cor (ou todos na cor hex, se vier uma);
    // com engulf, o cartão inteiro queima: as chamas sobem do pé dele, cobrem tudo e passam por cima, na frente dele, e
    // apagam atrás da borda do pó, conforme ele vira cinza (js/ash.js). Depois as chamas encolhem.
    window.HRFire = {
      burn: function (lis, hex, ms, engulf) {
        var until = performance.now() + ms;
        lis.forEach(function (li) { var f = fireOf(li, hex); f.goal = 1; f.lock = until; f.engulf = !!engulf; f.front = null; });
        setTimeout(function () { fires.forEach(function (f) { if (lis.indexOf(f.li) >= 0) { f.lock = 0; f.goal = 0; } }); }, ms);
        if (!fireRaf) fireRaf = requestAnimationFrame(burn);
      },
      // um cartão que acabou de se formar debaixo do mouse parado acende como se o mouse tivesse acabado de entrar
      wake: function (li) { if (fine && li.isConnected && li.matches(':hover')) ignite(li, true); }
    };
  }

  // ---------- Os títulos que se formam do pó ----------
  var ash = window.HRAsh;
  if (ash && !ash.reduced && window.IntersectionObserver) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        ash.run([e.target], { appear: true, duration: 1000, dust: 0.8, spots: function () {
          var r = document.createRange(); r.selectNodeContents(e.target);
          return Array.prototype.slice.call(r.getClientRects());
        } });
      });
    }, { threshold: 0.6 });
    document.querySelectorAll('.section__head h2, .about__hello, .contact__title').forEach(function (h) { h.classList.add('dust-in'); io.observe(h); });
  }
})();
