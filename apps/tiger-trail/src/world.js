/* Jungle environment: sky, lights, scrolling ground, recycled scenery and
   wildlife, plus builders for number coins and log obstacles. */
(function () {
  'use strict';

  const VIEW_DIST = 230;   // how far scenery extends
  const RECYCLE_Z = 16;    // past the camera -> recycle
  const FOG_COLOR = 0x9fd3c7;

  function lambert(color, opts) {
    return new THREE.MeshLambertMaterial(Object.assign({ color }, opts));
  }
  function flat(color) {
    return new THREE.MeshPhongMaterial({ color, flatShading: true });
  }

  // ===== ground =====
  function groundTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    // grass
    g.fillStyle = '#3e8d44';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#469c4c' : '#37803d';
      g.fillRect(Math.random() * 512, Math.random() * 512, 5, 12);
    }
    // dirt path down the middle (the 3 lanes); ground plane is 70 units wide,
    // so 86px of 512 ≈ 11.8 world units — just wider than the outer lanes
    const pathL = 213, pathR = 299;
    g.fillStyle = '#9c7a4f';
    g.fillRect(pathL, 0, pathR - pathL, 512);
    // elongated dirt streaks make the scroll direction easy to read
    for (let i = 0; i < 220; i++) {
      g.fillStyle = ['#8a6a42', '#a8865a', '#937149'][i % 3];
      g.fillRect(pathL + Math.random() * (pathR - pathL), Math.random() * 512, 6, 18);
    }
    // path edges
    g.fillStyle = '#6d5436';
    g.fillRect(pathL - 4, 0, 5, 512);
    g.fillRect(pathR - 1, 0, 5, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 7);
    return tex;
  }

  // ===== sky =====
  function skyDome() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#3d9be0');     // zenith blue
    grad.addColorStop(0.55, '#8ecbe8');  // mid sky
    grad.addColorStop(0.78, '#9fd3c7');  // matches the fog at the horizon
    grad.addColorStop(1, '#9fd3c7');
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(252, 24, 12),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
    );
    return dome;
  }

  function makeSun() {
    const grp = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(13, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff176, fog: false })
    );
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(21, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff9c4, fog: false, transparent: true, opacity: 0.35 })
    );
    glow.position.z = -0.5;
    grp.add(disc, glow);
    grp.position.set(50, 36, -205); // safely inside the 252-radius sky dome
    return grp;
  }

  function makeCloud() {
    const grp = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false });
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + Math.random() * 3, 0), mat);
      puff.position.set(i * 4.5 - n * 2, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 3);
      puff.scale.y = 0.55;
      grp.add(puff);
    }
    // keep clouds well inside the sky dome so they never clip through it
    grp.position.set(-115 + Math.random() * 230, 26 + Math.random() * 20, -140 - Math.random() * 55);
    grp.userData.drift = (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.6);
    return grp;
  }

  // ===== plants =====
  function jungleTree() {
    const grp = new THREE.Group();
    const h = 2.6 + Math.random() * 3.2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, h, 6), lambert(0x6d4c2f));
    trunk.position.y = h / 2;
    trunk.rotation.z = (Math.random() - 0.5) * 0.16;
    grp.add(trunk);
    // broadleaf blob canopy (not a pine!)
    const greens = [0x2e8b3a, 0x3aa047, 0x267a32, 0x4cae54];
    const blobs = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < blobs; i++) {
      const r = 0.9 + Math.random() * 0.9;
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), flat(greens[i % greens.length]));
      blob.position.set((Math.random() - 0.5) * 2.2, h + (Math.random() - 0.2) * 1.1, (Math.random() - 0.5) * 2.2);
      blob.scale.y = 0.75;
      grp.add(blob);
    }
    // hanging vines
    if (Math.random() < 0.55) {
      const vineMat = lambert(0x4e7d34);
      const vines = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < vines; i++) {
        const len = 1.2 + Math.random() * 1.6;
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, len, 4), vineMat);
        const vx = (Math.random() - 0.5) * 2.4;
        const vz = (Math.random() - 0.5) * 2.4;
        vine.position.set(vx, h + 0.4 - len / 2, vz);
        vine.rotation.z = (Math.random() - 0.5) * 0.25;
        grp.add(vine);
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), flat(0x66bb6a));
        leaf.position.set(vx, h + 0.4 - len, vz);
        grp.add(leaf);
      }
    }
    return grp;
  }

  function palmFronds(grp, h, color) {
    const frondMat = new THREE.MeshPhongMaterial({ color, flatShading: true, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 4), frondMat);
      const ang = (i / 6) * Math.PI * 2;
      frond.rotation.z = Math.cos(ang) * 1.25;
      frond.rotation.x = Math.sin(ang) * 1.25;
      frond.position.set(Math.cos(ang) * 0.9, h + 0.15, Math.sin(ang) * 0.9);
      grp.add(frond);
    }
  }

  function palmTree() {
    const grp = new THREE.Group();
    const h = 3 + Math.random() * 2.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, h, 5), lambert(0x8d6e44));
    trunk.position.y = h / 2;
    trunk.rotation.z = (Math.random() - 0.5) * 0.25;
    grp.add(trunk);
    palmFronds(grp, h, 0x43a047);
    return grp;
  }

  function bananaTree() {
    const grp = new THREE.Group();
    const h = 2.6 + Math.random() * 1.6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, h, 5), lambert(0x9aa14f));
    trunk.position.y = h / 2;
    grp.add(trunk);
    palmFronds(grp, h, 0x66bb22);
    // hanging banana bunches
    const bananaMat = lambert(0xffd028);
    const bunches = 1 + Math.floor(Math.random() * 2);
    for (let b = 0; b < bunches; b++) {
      const ang = Math.random() * Math.PI * 2;
      const bx = Math.cos(ang) * 0.55, bz = Math.sin(ang) * 0.55;
      for (let i = 0; i < 4; i++) {
        const bananaGeo = THREE.CapsuleGeometry
          ? new THREE.CapsuleGeometry(0.07, 0.22, 2, 5)
          : new THREE.CylinderGeometry(0.07, 0.07, 0.3, 5);
        const banana = new THREE.Mesh(bananaGeo, bananaMat);
        banana.position.set(bx + (i % 2) * 0.12 - 0.06, h - 0.45 - Math.floor(i / 2) * 0.16, bz + Math.floor(i / 2) * 0.1);
        banana.rotation.z = 0.5 + (i % 2) * 0.25;
        grp.add(banana);
      }
    }
    return grp;
  }

  function bush() {
    const grp = new THREE.Group();
    const mat = flat([0x33691e, 0x558b2f, 0x2e7d32][Math.floor(Math.random() * 3)]);
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const s = 0.5 + Math.random() * 0.6;
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat);
      ball.position.set((Math.random() - 0.5) * 1.2, s * 0.7, (Math.random() - 0.5) * 1.2);
      grp.add(ball);
    }
    if (Math.random() < 0.45) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 4), lambert(0x66bb6a));
      stem.position.y = 0.8;
      grp.add(stem);
      const bloom = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.22, 0),
        flat([0xec407a, 0xffca28, 0xab47bc][Math.floor(Math.random() * 3)])
      );
      bloom.position.y = 1.3;
      grp.add(bloom);
    }
    return grp;
  }

  function fern() {
    const grp = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color: 0x4caf50, flatShading: true, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 3), mat);
      const ang = (i / 5) * Math.PI * 2;
      blade.position.set(Math.cos(ang) * 0.25, 0.45, Math.sin(ang) * 0.25);
      blade.rotation.z = Math.cos(ang) * 0.7;
      blade.rotation.x = Math.sin(ang) * 0.7;
      grp.add(blade);
    }
    return grp;
  }

  function rock() {
    const grp = new THREE.Group();
    const s = 0.4 + Math.random() * 0.9;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), flat(0x8d8d88));
    r.position.y = s * 0.6;
    r.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    grp.add(r);
    return grp;
  }

  // ===== wildlife =====
  function snake() {
    const grp = new THREE.Group();
    const body = flat(0x7cb342);
    const dark = flat(0x33691e);
    for (let i = 0; i < 7; i++) {
      const r = 0.2 - i * 0.016;
      const seg = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.08, r), 6, 5), i % 2 ? dark : body);
      seg.position.set(Math.sin(i * 1.15) * 0.4, Math.max(0.08, r), i * 0.32);
      grp.add(seg);
    }
    // raised head with eyes and tongue
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), body);
    head.position.set(Math.sin(-1.15) * 0.4, 0.5, -0.3);
    grp.add(head);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.45, 5), body);
    neck.position.set(Math.sin(-0.5) * 0.4, 0.25, -0.18);
    neck.rotation.x = 0.35;
    grp.add(neck);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 4, 4), flat(0x111111));
      eye.position.set(head.position.x + s * 0.11, 0.58, -0.42);
      grp.add(eye);
    }
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.22), flat(0xd84343));
    tongue.position.set(head.position.x, 0.48, -0.55);
    grp.add(tongue);
    return grp;
  }

  function monkey() {
    const grp = new THREE.Group();
    const fur = lambert(0x6d4c41);
    const skin = lambert(0xd7b89c);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.38), fur);
    body.position.y = 0.55;
    grp.add(body);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.06), skin);
    belly.position.set(0, 0.5, 0.2);
    grp.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 6), fur);
    head.position.y = 1.05;
    grp.add(head);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), skin);
    face.position.set(0, 1.03, 0.16);
    grp.add(face);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), skin);
      ear.position.set(s * 0.27, 1.1, 0);
      grp.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), flat(0x111111));
      eye.position.set(s * 0.07, 1.1, 0.28);
      grp.add(eye);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 5), fur);
      arm.position.set(s * 0.28, 0.5, 0.08);
      arm.rotation.z = s * 0.35;
      grp.add(arm);
    }
    // curled tail
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 5, 10, Math.PI * 1.4), fur);
    tail.position.set(0, 0.5, -0.28);
    tail.rotation.y = Math.PI / 2;
    grp.add(tail);
    // banana in hand
    const banana = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 5), lambert(0xffd028));
    banana.position.set(0.34, 0.3, 0.14);
    banana.rotation.z = 0.9;
    grp.add(banana);
    return grp;
  }

  function panther() {
    const grp = new THREE.Group();
    const blk = lambert(0x23232a);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 1.35), blk);
    body.position.y = 0.72;
    grp.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), blk);
    head.position.set(0, 1.05, -0.78);
    grp.add(head);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 4), blk);
      ear.position.set(s * 0.14, 1.3, -0.74);
      grp.add(ear);
      // glowing green eyes
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.03), new THREE.MeshBasicMaterial({ color: 0x9cff57 }));
      eye.position.set(s * 0.11, 1.08, -1.0);
      grp.add(eye);
    }
    const legGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
    for (const p of [[-0.18, -0.5], [0.18, -0.5], [-0.18, 0.5], [0.18, 0.5]]) {
      const leg = new THREE.Mesh(legGeo, blk);
      leg.position.set(p[0], 0.3, p[1]);
      grp.add(leg);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.95, 5), blk);
    tail.position.set(0, 1.0, 0.85);
    tail.rotation.x = 0.85;
    grp.add(tail);
    return grp;
  }

  // weighted builder pools
  const PLANTS = [jungleTree, jungleTree, jungleTree, palmTree, palmTree, bananaTree, bananaTree, bush, bush, fern, fern, rock];
  const ANIMALS = [snake, monkey, monkey, panther];

  // ===== number coin (golden disc with the number on both faces) =====
  const numberTexCache = {};
  function numberTexture(value) {
    const key = String(value);
    if (numberTexCache[key]) return numberTexCache[key];
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 110, 30, 128, 128, 128);
    grad.addColorStop(0, '#ffe082');
    grad.addColorStop(1, '#ffb300');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#e65100';
    g.lineWidth = 14;
    g.beginPath();
    g.arc(128, 128, 112, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#4e2600';
    const fontSize = key.length >= 3 ? 105 : key.length === 2 ? 130 : 150;
    g.font = `900 ${fontSize}px "Avenir Next", "Arial Black", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(key, 128, 140);
    const tex = new THREE.CanvasTexture(c);
    numberTexCache[key] = tex;
    return tex;
  }

  const coinSideMat = lambert(0xff8f00);
  function makeNumberCoin(value) {
    const faceMat = lambert(0xffffff, { map: numberTexture(value) });
    const geo = new THREE.CylinderGeometry(0.85, 0.85, 0.22, 24);
    const coin = new THREE.Mesh(geo, [coinSideMat, faceMat, faceMat]);
    coin.rotation.x = Math.PI / 2; // flat face toward camera
    coin.rotation.y = Math.PI / 2;
    const grp = new THREE.Group();
    grp.add(coin);
    grp.userData.coinMesh = coin;
    return grp;
  }

  /** Tint a missed coin red (clones materials so other coins are unaffected). */
  function tintCoinRed(group) {
    const coin = group.userData.coinMesh;
    coin.material = coin.material.map((m) => {
      const c = m.clone();
      c.color = new THREE.Color(0xff4136);
      return c;
    });
  }

  // ===== log obstacle =====
  function barkTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#5d4024';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = ['#6d4c2f', '#4e3620', '#54381f'][i % 3];
      g.fillRect(0, Math.random() * 128, 128, 4 + Math.random() * 5);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    return tex;
  }
  let barkTex = null;
  function makeLog() {
    if (!barkTex) barkTex = barkTexture();
    const grp = new THREE.Group();
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 2.4, 9),
      lambert(0xffffff, { map: barkTex })
    );
    log.rotation.z = Math.PI / 2; // lie across the lane
    log.position.y = 0.5;
    log.castShadow = true;
    grp.add(log);
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(0.5, 9), lambert(0xc8a165));
      cap.position.set(s * 1.21, 0.5, 0);
      cap.rotation.y = s * Math.PI / 2;
      grp.add(cap);
    }
    return grp;
  }

  // ===== vine gate obstacle (roll under it!) =====
  function makeVine() {
    const grp = new THREE.Group();
    const stalk = lambert(0x7a9a3d);
    const vineGreen = lambert(0x4e7d34);
    // bamboo side poles
    for (const s of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.3, 6), stalk);
      pole.position.set(s * 1.35, 1.15, 0);
      grp.add(pole);
    }
    // crossbar wrapped in vine
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.9, 6), vineGreen);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 2.05;
    grp.add(bar);
    // dangling vine strands with leaves — bottom edge sits ~1.25 so the tiger
    // must roll, not jump
    for (let i = 0; i < 5; i++) {
      const x = -1.1 + i * 0.55;
      const len = 0.5 + Math.random() * 0.35;
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, len, 4), vineGreen);
      strand.position.set(x, 2.05 - len / 2, 0);
      grp.add(strand);
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), flat(0x66bb6a));
      leaf.position.set(x, 2.05 - len, 0.05);
      grp.add(leaf);
    }
    // a flower so it reads as friendly jungle, not a wall
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), flat(0xec407a));
    bloom.position.set(0.8, 2.05, 0.12);
    grp.add(bloom);
    return grp;
  }

  // ===== world =====
  class World {
    constructor(scene, quality) {
      this.scene = scene;
      this.quality = quality;

      scene.background = new THREE.Color(0x8ecbe8);
      scene.fog = new THREE.Fog(FOG_COLOR, 40, 170);

      // sky
      scene.add(skyDome());
      scene.add(makeSun());
      this.clouds = [];
      const cloudCount = quality === 'low' ? 5 : 9;
      for (let i = 0; i < cloudCount; i++) {
        const cl = makeCloud();
        scene.add(cl);
        this.clouds.push(cl);
      }

      // lights
      this.hemi = new THREE.HemisphereLight(0xdfffea, 0x2e4a2c, 0.95);
      scene.add(this.hemi);
      this.sun = new THREE.DirectionalLight(0xfff3d6, 1.0);
      this.sun.position.set(14, 26, -10);
      scene.add(this.sun);
      this.setQuality(quality);

      // grass underlay reaching the horizon on all sides
      const underlay = new THREE.Mesh(new THREE.PlaneGeometry(700, 460), lambert(0x3e8d44));
      underlay.rotation.x = -Math.PI / 2;
      underlay.position.set(0, -0.07, -120);
      scene.add(underlay);

      // textured ground strip with the running path
      this.groundTex = groundTexture();
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(70, VIEW_DIST + 60),
        lambert(0xffffff, { map: this.groundTex })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.z = -VIEW_DIST / 2 + 30;
      ground.receiveShadow = true;
      scene.add(ground);
      this.scrollPos = 0;

      // scenery pools on both sides of the path
      this.scenery = [];
      const plantCount = quality === 'low' ? 60 : 115;
      const animalCount = quality === 'low' ? 6 : 11;
      for (let i = 0; i < plantCount; i++) this.addScenery(PLANTS[i % PLANTS.length](), 'plant');
      for (let i = 0; i < animalCount; i++) this.addScenery(ANIMALS[i % ANIMALS.length](), 'animal');
    }

    addScenery(item, kind) {
      item.userData.kind = kind;
      this.placeScenery(item, true);
      this.scene.add(item);
      this.scenery.push(item);
    }

    setQuality(q) {
      this.quality = q;
      this.sun.castShadow = q === 'high';
      if (q === 'high') {
        this.sun.shadow.mapSize.set(1024, 1024);
        const sc = this.sun.shadow.camera;
        sc.left = -12; sc.right = 12; sc.top = 8; sc.bottom = -8;
        sc.near = 5; sc.far = 70;
      }
    }

    placeScenery(item, initial) {
      const side = Math.random() < 0.5 ? -1 : 1;
      // animals stay near the path edge where the player can see them;
      // plants cluster toward the road (pow biases small values) for a jungle-corridor feel
      item.position.x = item.userData.kind === 'animal'
        ? side * (7 + Math.random() * 6)
        : side * (7.5 + Math.pow(Math.random(), 1.6) * 24);
      item.position.z = initial
        ? -Math.random() * VIEW_DIST + 10
        : -VIEW_DIST + RECYCLE_Z + Math.random() * 12;
      item.rotation.y = Math.random() * Math.PI * 2;
      const s = item.userData.kind === 'animal'
        ? 0.9 + Math.random() * 0.25
        : 0.8 + Math.random() * 0.5;
      item.scale.set(s, s, s);
    }

    update(dt, speed) {
      // scroll ground texture toward the camera (repeat.y=7 over plane length)
      this.scrollPos += (speed * dt * 7) / (VIEW_DIST + 60);
      this.groundTex.offset.y = this.scrollPos % 1;
      for (const item of this.scenery) {
        item.position.z += speed * dt;
        if (item.position.z > RECYCLE_Z) this.placeScenery(item, false);
      }
      for (const cl of this.clouds) {
        cl.position.x += cl.userData.drift * dt;
        if (Math.abs(cl.position.x) > 125) cl.position.x = -Math.sign(cl.position.x) * 125;
      }
    }

    reset() {
      for (const item of this.scenery) this.placeScenery(item, true);
    }
  }

  window.JungleWorld = {
    World,
    makeNumberCoin,
    makeLog,
    makeVine,
    tintCoinRed,
  };
})();
