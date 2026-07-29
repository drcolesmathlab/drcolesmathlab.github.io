/* Low-poly tiger model built from primitives, with procedural run/jump animation. */
(function () {
  'use strict';

  function stripeTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#f57c00';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#1a1a1a';
    // irregular vertical tiger stripes
    const xs = [18, 52, 88, 122, 158, 192, 228];
    xs.forEach((x, i) => {
      const w = 9 + (i % 3) * 4;
      g.save();
      g.translate(x, 0);
      g.rotate((i % 2 ? 1 : -1) * 0.08);
      g.beginPath();
      g.moveTo(0, -10);
      g.quadraticCurveTo(w, 80, 0, 150 + (i % 2) * 40);
      g.quadraticCurveTo(-w, 80, 0, -10);
      g.fill();
      g.beginPath();
      g.moveTo(0, 266);
      g.quadraticCurveTo(-w, 200, 0, 140);
      g.quadraticCurveTo(w, 200, 0, 266);
      g.fill();
      g.restore();
    });
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function mat(color, opts) {
    return new THREE.MeshLambertMaterial(Object.assign({ color }, opts));
  }

  class Tiger {
    constructor() {
      const stripes = stripeTexture();
      const orange = mat(0xffffff, { map: stripes });
      const orangePlain = mat(0xf57c00);
      const white = mat(0xfff3e0);
      const black = mat(0x1a1a1a);
      const pink = mat(0xef9a9a);

      this.group = new THREE.Group();
      // inner pivot at body height so the tumble roll spins around the
      // tiger's center, not its feet
      this.inner = new THREE.Group();
      this.inner.position.y = 1.0;
      this.group.add(this.inner);

      // body
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.85, 1.7), orange);
      body.position.y = 0.05;
      body.castShadow = true;
      this.body = body;
      this.inner.add(body);

      // chest / belly
      const belly = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.3, 1.3), white);
      belly.position.set(0, -0.35, 0);
      body.add(belly);

      // head
      const head = new THREE.Group();
      head.position.set(0, 0.55, -0.95);
      const skull = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.75), orange);
      skull.castShadow = true;
      head.add(skull);
      const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.3), white);
      muzzle.position.set(0, -0.16, -0.45);
      head.add(muzzle);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.06), pink);
      nose.position.set(0, -0.06, -0.62);
      head.add(nose);
      // ears
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.12), orangePlain);
        ear.position.set(s * 0.3, 0.45, -0.05);
        head.add(ear);
        const inner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.04), pink);
        inner.position.set(0, 0, -0.05);
        ear.add(inner);
        // eyes
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), black);
        eye.position.set(s * 0.2, 0.05, -0.37);
        head.add(eye);
        // cheek stripes
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.08), black);
        cheek.position.set(s * 0.43, -0.1, -0.2);
        head.add(cheek);
      }
      this.head = head;
      body.add(head);

      // legs (pivot at hip/shoulder so they swing)
      this.legs = [];
      const legGeo = new THREE.BoxGeometry(0.26, 0.72, 0.26);
      legGeo.translate(0, -0.36, 0);
      const pawGeo = new THREE.BoxGeometry(0.3, 0.14, 0.34);
      const positions = [
        [-0.34, -0.05, -0.6], [0.34, -0.05, -0.6], // front
        [-0.34, -0.05, 0.62], [0.34, -0.05, 0.62], // back
      ];
      positions.forEach((p, i) => {
        const leg = new THREE.Mesh(legGeo, i < 2 ? orangePlain : orange);
        leg.position.set(p[0], p[1], p[2]);
        leg.castShadow = true;
        const paw = new THREE.Mesh(pawGeo, white);
        paw.position.set(0, -0.72, -0.04);
        leg.add(paw);
        this.legs.push(leg);
        this.inner.add(leg);
      });

      // tail: two segments with black tip
      const tail = new THREE.Group();
      tail.position.set(0, 0.35, 0.85);
      const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.55), orangePlain);
      seg1.position.z = 0.27;
      tail.add(seg1);
      const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.4), orangePlain);
      seg2.position.set(0, 0.12, 0.68);
      seg2.rotation.x = -0.5;
      tail.add(seg2);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.18), black);
      tip.position.set(0, 0.22, 0.92);
      tail.add(tip);
      tail.rotation.x = 0.45;
      this.tail = tail;
      body.add(tail);

      this.runT = 0;
    }

    /** Forward-somersault angle (0 = upright). Negative pitches nose-down. */
    setRoll(angle) {
      this.inner.rotation.x = angle;
    }

    /** dt: seconds; speed: world speed; airborne: jumping flag */
    update(dt, speed, airborne) {
      this.runT += dt * (6 + speed * 0.55);
      const t = this.runT;
      if (airborne) {
        // tuck legs, lean forward
        this.legs[0].rotation.x = -0.9;
        this.legs[1].rotation.x = -0.9;
        this.legs[2].rotation.x = 0.9;
        this.legs[3].rotation.x = 0.9;
        this.body.rotation.x = -0.12;
        this.tail.rotation.x = 0.1;
      } else {
        // gallop cycle: diagonal pairs
        const a = Math.sin(t) * 0.75;
        this.legs[0].rotation.x = a;
        this.legs[3].rotation.x = a;
        this.legs[1].rotation.x = -a;
        this.legs[2].rotation.x = -a;
        this.body.position.y = 0.05 + Math.abs(Math.sin(t)) * 0.09;
        this.body.rotation.x = Math.sin(t * 2) * 0.03;
        this.tail.rotation.x = 0.45 + Math.sin(t * 0.9) * 0.15;
        this.tail.rotation.y = Math.sin(t * 0.6) * 0.25;
        this.head.rotation.y = Math.sin(t * 0.4) * 0.05;
      }
    }
  }

  window.Tiger = Tiger;
})();
