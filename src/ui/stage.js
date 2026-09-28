
/* ------------------------------------------------------------------ scene 3D */
const Stage = (() => {
  let ok = false, renderer, scene, camera, root, composer = null, bloom = null, useBloom = false, dark = true;
  let stars, starMat, floorG, sweepMat, scanRing, ptsMat, geo, pts, axes, beamMats = [], ticks, arrows, sphere, drops, dropGeo, dots, dotGeo, bary, ghost = null, links, linkGeo, raycaster;
  const pointer = new THREE.Vector2(); let labels = [], items = [], W = 1, H = 1;
  let anim = null, camAnim = null, drag = null, pinch = null, idle = 0, view = "3d", hover = -1, selected = -1, selNb = [], scale = 1, focusSet = null, first = true;
  let t0 = performance.now(), frames = 0, fpsT = performance.now(), fps = 60, gizmoTick = 0;
  const show = { names: true, arrows: true, sphere: true, rotate: !reduced, drops: true, bary: true, net: false, dens: false, unc: false };
  let mode = "normal", hyp = null, rays = null, hsphere = null, net = null, netEdges = [], netCols = null, terrain = null, terrainMat = null, unc = null, arrowR0 = 1;
  const hyCard = $("#hyCard"), lassoSvg = $("#lasso");
  let selSet = null, selIso = false, lasso = null, lassoOn = false, treeG = null, treeT0 = 0, cal = null, embName = null, lod = { shown: 0, total: 0 };
  const LOD = 60000;
  const el = $("#stage"), layer = $("#labels"), tip = $("#tip"), gizmo = $("#gizmo"), tele = $("#telemetry");
  const VIEWS = { "3d": [new THREE.Vector3(15, 10.5, 17), new THREE.Vector3(0, 1, 0)], "12": [new THREE.Vector3(0, 30, 0.0001), new THREE.Vector3(0, 0, -1)], "13": [new THREE.Vector3(0, 0, 30), new THREE.Vector3(0, 1, 0)], "23": [new THREE.Vector3(30, 0, 0), new THREE.Vector3(0, 1, 0)] };
  const DIRS = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)];
  const world = v => new THREE.Vector3((v[0] || 0) * scale, (v[2] || 0) * scale, -(v[1] || 0) * scale);
  const ease = t => 1 - Math.pow(1 - t, 4);
  const randDir = () => { const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u); return new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th)); };
  const col = n => new THREE.Color(cssVar(n) || "#ffffff");

  function init() {
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); } catch (e) { el.insertAdjacentHTML("beforeend", `<div class="nowebgl">La 3D n'est pas disponible sur cet appareil. Les plans factoriels 2D restent consultables dans les onglets.</div>`); return; }
    ok = true; renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); el.prepend(renderer.domElement);
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
    camera.position.set(-6, 46, 70); camera.lookAt(0, 0, 0); root = new THREE.Group(); scene.add(root);
    // champ d'etoiles scintillant
    const N = 2200, sg = new THREE.BufferGeometry(), sp = new Float32Array(N * 3), ph = new Float32Array(N), sz = new Float32Array(N);
    for (let i = 0; i < N; i++) { const r = 60 + Math.random() * 110, d = randDir(); sp.set([d.x * r, d.y * r, d.z * r], i * 3); ph[i] = Math.random(); sz[i] = 0.25 + Math.random() * 0.55; }
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3)); sg.setAttribute("phase", new THREE.BufferAttribute(ph, 1)); sg.setAttribute("sz", new THREE.BufferAttribute(sz, 1));
    starMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uColor: { value: new THREE.Color("#8E98B0") }, uOpacity: { value: 0.8 } },
      vertexShader: `attribute float phase; attribute float sz; uniform float uTime; uniform float uScale; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = sz * uScale / -mv.z; vA = 0.5 + 0.5 * sin(uTime * (0.7 + phase * 1.6) + phase * 6.2831); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ vec2 c = gl_PointCoord - vec2(0.5); float d = length(c); if (d > 0.5) discard; gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.0, 0.5, d)) * vA * uOpacity); }` });
    stars = new THREE.Points(sg, starMat); scene.add(stars);
    // points : disque net + halo, taille et opacite par point
    ptsMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uScale: { value: 400 }, uGlow: { value: 0.55 }, uAlpha: { value: 1 } },
      vertexShader: `attribute float size; attribute vec3 color; attribute float alpha; varying vec3 vColor; varying float vAlpha; uniform float uScale; void main(){ vColor = color; vAlpha = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vColor; varying float vAlpha; uniform float uGlow; uniform float uAlpha; void main(){ vec2 c = gl_PointCoord - vec2(0.5); float d = length(c); if (d > 0.5) discard; float core = 1.0 - smoothstep(0.15, 0.21, d); float ring = smoothstep(0.24, 0.27, d) * (1.0 - smoothstep(0.29, 0.33, d)) * 0.45; float halo = pow(1.0 - smoothstep(0.0, 0.5, d), 2.4) * uGlow; float a = max(core, halo) + ring; vec3 col = mix(vColor, vec3(1.0), core * 0.25); gl_FragColor = vec4(col, a * vAlpha * uAlpha); }` });
    // sol : grille radar, balayage, onde
    floorG = new THREE.Group(); scene.add(floorG);
    sweepMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color("#4FD8E8") }, uOpacity: { value: 1 } },
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy / 9.6; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uOpacity; varying vec2 vP; void main(){ float r = length(vP); if (r > 1.0) discard; float ang = atan(vP.y, vP.x); float sw = mod(uTime * 0.55, 6.28318); float d = mod(sw - ang + 6.28318, 6.28318); float a = (1.0 - smoothstep(0.0, 1.35, d)) * 0.34 * (0.25 + 0.75 * r); float edge = smoothstep(0.0, 0.02, d) * (1.0 - smoothstep(0.02, 0.05, d)) * 0.5 * r; gl_FragColor = vec4(uColor, (a + edge) * uOpacity * (1.0 - smoothstep(0.96, 1.0, r))); }` });
    const sweep = new THREE.Mesh(new THREE.CircleGeometry(9.6, 128), sweepMat); sweep.rotation.x = -Math.PI / 2; sweep.position.y = -0.01; floorG.add(sweep);
    scanRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 160), new THREE.MeshBasicMaterial({ color: 0x4FD8E8, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
    scanRing.rotation.x = -Math.PI / 2; floorG.add(scanRing);
    hsphere = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(9.6, 2)), new THREE.LineBasicMaterial({ color: 0x4FD8E8, transparent: true, opacity: 0.1, depthWrite: false })); hsphere.visible = false; scene.add(hsphere);
    terrainMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: { derivatives: true }, uniforms: { uTime: { value: 0 }, uOp: { value: 1 }, uRamp: { value: RAMP.map(h => new THREE.Color(h)) } },
      vertexShader: `attribute float h; varying float vH; varying vec2 vXZ; void main(){ vH = h; vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uRamp[5]; uniform float uOp; uniform float uTime; varying float vH; varying vec2 vXZ;
        vec3 rampc(float t){ t = clamp(t, 0.0, 1.0) * 4.0; if (t < 1.0) return mix(uRamp[0], uRamp[1], t); if (t < 2.0) return mix(uRamp[1], uRamp[2], t - 1.0); if (t < 3.0) return mix(uRamp[2], uRamp[3], t - 2.0); return mix(uRamp[3], uRamp[4], t - 3.0); }
        void main(){ float r = length(vXZ) / 10.0; if (r > 1.0) discard;
          float lv = vH * 10.0; float fw = max(fwidth(lv), 1e-4); float iso = 1.0 - smoothstep(0.0, fw * 1.5, abs(fract(lv - 0.5) - 0.5));
          vec2 gq = vXZ; vec2 fg = abs(fract(gq - 0.5) - 0.5) / max(fwidth(gq), vec2(1e-4)); float grid = 1.0 - min(min(fg.x, fg.y), 1.0);
          float wave = exp(-pow((r - fract(uTime * 0.12)) * 16.0, 2.0));
          float a = 0.012 + 0.13 * vH + iso * (0.10 + 0.30 * vH) + grid * 0.035 + wave * 0.18 * vH;
          gl_FragColor = vec4(mix(rampc(vH) * 0.85, vec3(1.0), iso * 0.2), clamp(a * (1.0 - smoothstep(0.86, 1.0, r)) * uOp, 0.0, 1.0)); }` });
    hyCard.addEventListener("click", e => { const b = e.target.closest("[data-hy]"); if (b) hyCmd(b.dataset.hy); });
    raycaster = new THREE.Raycaster();
    if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
      try { composer = new THREE.EffectComposer(renderer); composer.addPass(new THREE.RenderPass(scene, camera)); bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.95, 0.55, 0.16); composer.addPass(bloom); } catch (e) { composer = null; }
    }
    resize(); new ResizeObserver(resize).observe(el); bindControls(); applyTheme(false); requestAnimationFrame(loop);
  }
  function resize() {
    if (!ok) return; W = el.clientWidth; H = el.clientHeight; renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio?.(renderer.getPixelRatio()); composer.setSize(W, H); }
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const s = H / (2 * Math.tan(camera.fov * Math.PI / 360)) * renderer.getPixelRatio(); ptsMat.uniforms.uScale.value = s; starMat.uniforms.uScale.value = s;
  }
  function buildFloor() {
    floorG.children.filter(o => o.userData.grid).forEach(o => { floorG.remove(o); o.geometry.dispose(); o.material.dispose(); });
    const gc = col("--faint");
    [3, 6, 9].forEach((r, i) => { const l = ring(r, "y", gc, 0.55 - i * 0.12); l.userData.grid = 1; floorG.add(l); });
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r0 = i % 2 ? 6 : 0; const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a) * r0, 0, Math.sin(a) * r0), new THREE.Vector3(Math.cos(a) * 9.6, 0, Math.sin(a) * 9.6)]), new THREE.LineBasicMaterial({ color: gc, transparent: true, opacity: i % 2 ? 0.1 : 0.2 })); l.userData.grid = 1; floorG.add(l); }
  }
  function applyTheme(rebuild = true) {
    if (typeof colorCache !== "undefined") colorCache.clear();
    if (!ok) return; dark = isDark(); useBloom = dark && !!composer;
    const bg = col("--bg-2"); scene.background = useBloom ? bg : null; scene.fog = dark ? new THREE.FogExp2(bg, 0.006) : null;
    ptsMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending; ptsMat.uniforms.uGlow.value = dark ? 0.55 : 0.22; ptsMat.needsUpdate = true;
    starMat.uniforms.uColor.value = col("--faint"); starMat.uniforms.uOpacity.value = dark ? 0.9 : 0.45;
    sweepMat.uniforms.uColor.value = col("--a2"); sweepMat.uniforms.uOpacity.value = dark ? 1 : 0.55; sweepMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending; sweepMat.needsUpdate = true;
    scanRing.material.color = col("--a2"); hsphere.material.color = col("--a2"); hsphere.material.opacity = dark ? 0.1 : 0.14;
    terrainMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending; terrainMat.uniforms.uOp.value = dark ? 0.9 : 2.2; terrainMat.needsUpdate = true;
    buildFloor();
    if (rebuild && state.res) build(state.res, "none");
  }
  function clear(obj) { if (!obj) return; obj.parent?.remove(obj); obj.traverse(o => { o.geometry?.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m !== ptsMat && m !== terrainMat && m.dispose()); }); }
  function beam(dir, len, color) {
    const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }), mg = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.13, depthWrite: false });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len * 2, 8), m), halo = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len * 2, 12), mg), cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 20), m);
    cone.position.y = len; const tail = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), m); tail.position.y = -len; g.add(core, halo, cone, tail);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); g.userData.mats = [m, mg]; return g;
  }
  function ring(radius, axis, color, op) { const c = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2, x = Math.cos(a) * radius, y = Math.sin(a) * radius; c.push(axis === "y" ? new THREE.Vector3(x, 0, y) : axis === "z" ? new THREE.Vector3(x, y, 0) : new THREE.Vector3(0, x, y)); } return new THREE.Line(new THREE.BufferGeometry().setFromPoints(c), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); }
  function modelOf(res) {
    const P = [], A = [], dims = Math.min(res.q, 3), gi = groupIndex(res);
    // niveau de detail : au-dela de LOD individus, un echantillon est affiche (les calculs portent toujours sur la totalite)
    const idx = res.method !== "AFC" && res.n > LOD ? sampleRows(res.n, LOD, 31) : range(res.method === "AFC" ? res.I : res.n); lod = { shown: idx.length, total: res.method === "AFC" ? res.I : res.n };
    if (res.method === "ACP" || res.method === "AFDM") {
      const K3 = Math.min(3, res.q), score = idx.map(i => { let s = 0; for (let k = 0; k < K3; k++) s += res.F[i][k] ** 2 / res.vals[k]; return s; }), thr = score.slice().sort((a, b) => b - a)[Math.min(11, idx.length - 1)];
      idx.forEach((i, t) => P.push({ v: res.F[i], color: gi ? `--g${gi.idx[i] % 10 + 1}` : "--a2", size: 0.78, label: res.names[i], kind: "ind", i, lab: score[t] >= thr, grp: gi ? gi.idx[i] : -1 }));
      res.coord.forEach((c, j) => A.push({ v: c, color: `--a${dominantAxis(res.vcos2[j], res.nAxes) + 1}`, label: res.vars[j] }));
      if (res.method === "AFDM") { const vi = res.qvars; res.G.forEach((g, j) => P.push({ v: g, color: `--g${vi.indexOf(res.modVar[j]) % 10 + 1}`, size: 1.0, label: res.mods[j], kind: "mod", i: j, lab: true, grp: -1 })); }
    } else if (res.method === "ACM") {
      idx.forEach(i => P.push({ v: res.F[i], color: gi ? `--g${gi.idx[i] % 10 + 1}` : "--faint", size: 0.44, label: res.names[i], kind: "ind", i, lab: false, grp: gi ? gi.idx[i] : -1 }));
      const vi = [...new Set(res.modVar)]; res.G.forEach((g, j) => P.push({ v: g, color: `--g${vi.indexOf(res.modVar[j]) % 10 + 1}`, size: 1.0, label: res.mods[j], kind: "mod", i: j, lab: true, grp: -1 }));
    } else {
      res.F.forEach((f, i) => P.push({ v: f, color: "--a2", size: 1.0, label: res.rowL[i], kind: "row", i, lab: true, grp: -1 }));
      res.G.forEach((g, j) => P.push({ v: g, color: "--a1", size: 1.1, label: res.colL[j], kind: "col", i: j, lab: true, grp: -1 }));
    }
    if (res.supp && res.method !== "AFC") {
      res.supp.quali.forEach(v => v.mods.forEach((m, t) => P.push({ v: m.coord, color: "--amber", size: 1.05, label: `${v.name} = ${m.cat}`, kind: "sup", i: P.length, ref: [v.name, t], lab: true, grp: -1 })));
      if (hasQ(res)) res.supp.quanti.forEach(q => A.push({ v: q.coord, color: "--amber", label: q.name, dashed: true }));
    }
    // densite : plus il y a de points, plus ils sont petits et discrets (sinon le halo additif sature en blanc)
    const km = res.method === "AFC" ? "row" : "ind", nMain = P.filter(p => p.kind === km).length, dens = clamp(Math.sqrt(90 / Math.max(nMain, 1)), 0.34, 1); P.forEach(p => { if (p.kind === km) p.size *= 0.5 + 0.5 * dens; });
    ptsMat.uniforms.uGlow.value = dark ? 0.55 * (0.25 + 0.75 * dens) : 0.22; ptsMat.uniforms.uAlpha.value = dark ? 0.5 + 0.5 * dens : 1;
    if (bloom) { bloom.strength = 0.95 * (0.4 + 0.6 * dens); bloom.threshold = 0.16 + 0.34 * (1 - dens); }
    const enc = typeof encodeFor === "function" ? encodeFor(res) : null;
    if (enc) P.forEach(p => { if (p.kind === enc.kind) { if (enc.hex) p.hex = enc.hex[p.i]; if (enc.size) p.size *= enc.size[p.i]; } });
    return { P, A, dims, gi };
  }
  function build(res, mode = "morph") {
    if (!ok) return; if (mode !== "normal") dropHyper();
    const { P, A, dims, gi } = modelOf(res), old = items.map(it => it.cur.clone());
    const g0 = ghost ? { F: ghost.F, nb: ghost.nb } : null; if (ghost) { clear(ghost.group); ghost = null; }
    let mx = 1e-9; P.forEach(p => p.v.slice(0, 3).forEach(x => (mx = Math.max(mx, Math.abs(x)))));
    scale = 9 / mx; const arrowR = 0.9 * mx; arrowR0 = arrowR;
    [pts, axes, ticks, arrows, sphere, drops, dots, bary, links, net, terrain, unc, cal].forEach(clear); net = terrain = unc = cal = null; labels.forEach(l => l.el.remove()); labels = []; beamMats = [];
    // axes + graduations
    axes = new THREE.Group(); ticks = new THREE.Group();
    const step = niceStep(mx / 3.2), tv = [], perp = [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 0)];
    for (let k = 0; k < dims; k++) {
      const b = beam(DIRS[k], 10.6, col(`--a${k + 1}`)); beamMats[k] = b.userData.mats; axes.add(b);
      addLabel(DIRS[k].clone().multiplyScalar(11.7), `<span style="color:var(--a${k + 1})">AXE ${k + 1}</span> ${pc(res.pct[k])}${axisName(k) ? " · " + esc(axisName(k)) : ""}`, "axis");
      let c = 0; for (let t = step; t <= mx * 1.02; t += step) for (const sg of [-1, 1]) { const p = DIRS[k].clone().multiplyScalar(sg * t * scale), d = perp[k].clone().multiplyScalar(0.2); tv.push(p.clone().add(d), p.clone().sub(d)); if (++c <= 4 && (Math.round(t / step) % 2 === 0 || mx / step < 4)) addLabel(p.clone().add(perp[k].clone().multiplyScalar(0.45)), (sg > 0 ? "+" : "−") + fr(t, step < 1 ? 1 : 0), "tick"); }
    }
    if (tv.length) ticks.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tv), new THREE.LineBasicMaterial({ color: col("--muted"), transparent: true, opacity: 0.55 })));
    root.add(axes, ticks);
    // sphere des correlations et fleches
    sphere = new THREE.Group(); arrows = new THREE.Group();
    if (hasQ(res)) {
      const Rw = arrowR * scale, sc = col("--faint"); ["x", "y", "z"].forEach(ax => sphere.add(ring(Rw, ax, sc, 0.4)));
      A.forEach(a => { const tipv = world(a.v.map(x => x * arrowR)), len = tipv.length(); if (len < 1e-6) return; const c = col(a.color);
        if (a.dashed) { const g = new THREE.Group(), ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), tipv.clone().multiplyScalar(1 - 0.5 / len)]), new THREE.LineDashedMaterial({ color: c, dashSize: 0.35, gapSize: 0.22 })); ln.computeLineDistances();
          const head = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.45, 14), new THREE.MeshBasicMaterial({ color: c })); head.position.copy(tipv.clone().multiplyScalar(1 - 0.22 / len)); head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipv.clone().normalize());
          g.add(ln, head); arrows.add(g); addLabel(tipv.clone().multiplyScalar(1.08), esc(a.label) + " <i class='sup'>illustr.</i>", "var", g); return; }
        const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: c }); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, Math.max(len - 0.5, 0.01), 8), m); shaft.position.y = (len - 0.5) / 2;
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 16), m); head.position.y = len - 0.25; g.add(shaft, head); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipv.clone().normalize()); arrows.add(g);
        addLabel(tipv.clone().multiplyScalar(1.08), esc(a.label), "var", g); });
    }
    sphere.visible = show.sphere; arrows.visible = show.arrows; root.add(sphere, arrows);
    // nuage
    const n = P.length; geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), cl = new Float32Array(n * 3), siz = new Float32Array(n), al = new Float32Array(n).fill(1);
    const reuse = mode === "morph" && old.length === n;
    items = P.map((p, i) => { const target = world(p.v), c = p.hex ? new THREE.Color(p.hex) : col(p.color); const start = reuse ? old[i] : mode === "none" ? target.clone() : randDir().multiplyScalar(13 + Math.random() * 7);
      cl.set([c.r, c.g, c.b], i * 3); siz[i] = p.size; return { ...p, rgb: c, target, from: start.clone(), cur: start.clone(), delay: reuse || mode === "none" ? 0 : (i / n) * 560 }; });
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(cl, 3)); geo.setAttribute("size", new THREE.BufferAttribute(siz, 1)); geo.setAttribute("alpha", new THREE.BufferAttribute(al, 1));
    pts = new THREE.Points(geo, ptsMat); pts.renderOrder = 3; root.add(pts); raycaster.params.Points.threshold = 0.35;
    // projections verticales vers le plan (1,2)
    const bgc = col("--bg-2"); dropGeo = new THREE.BufferGeometry(); const dp = new Float32Array(n * 6), dc = new Float32Array(n * 6);
    items.forEach((it, i) => { dc.set([it.rgb.r, it.rgb.g, it.rgb.b, bgc.r, bgc.g, bgc.b], i * 6); });
    dropGeo.setAttribute("position", new THREE.BufferAttribute(dp, 3)); dropGeo.setAttribute("color", new THREE.BufferAttribute(dc, 3));
    drops = new THREE.LineSegments(dropGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: dark ? 0.42 : 0.3, depthWrite: false }));
    dotGeo = new THREE.BufferGeometry(); dotGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3)); dotGeo.setAttribute("color", new THREE.BufferAttribute(cl.slice(), 3)); dotGeo.setAttribute("size", new THREE.BufferAttribute(new Float32Array(n).fill(0.26), 1)); dotGeo.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(n).fill(0.45), 1));
    dots = new THREE.Points(dotGeo, ptsMat); drops.visible = dots.visible = show.drops && dims >= 3; root.add(drops, dots);
    // barycentres des groupes
    bary = new THREE.Group();
    if (gi && res.method !== "AFC") {
      const K = gi.cats.length, C = range(K).map(() => [0, 0, 0, 0]); items.forEach(it => { if (it.kind === "ind" && it.grp >= 0) { const c = C[it.grp]; c[0] += it.v[0]; c[1] += it.v[1]; c[2] += it.v[2] || 0; c[3]++; } });
      const bp = [], bc = [], lv = [], lc = [];
      C.forEach((c, g) => { if (!c[3]) return; const w = world([c[0] / c[3], c[1] / c[3], c[2] / c[3]]), cc = col(`--g${g % 10 + 1}`); bp.push(w.x, w.y, w.z); bc.push(cc.r, cc.g, cc.b);
        items.forEach(it => { if (it.kind === "ind" && it.grp === g) { lv.push(w.x, w.y, w.z, it.target.x, it.target.y, it.target.z); lc.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b); } });
        addLabel(w.clone().add(new THREE.Vector3(0, 0.6, 0)), esc(gi.cats[g]), "bary", bary); });
      const bg2 = new THREE.BufferGeometry(); bg2.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3)); bg2.setAttribute("color", new THREE.Float32BufferAttribute(bc, 3)); bg2.setAttribute("size", new THREE.Float32BufferAttribute(bp.map(() => 1.5).slice(0, bp.length / 3), 1)); bg2.setAttribute("alpha", new THREE.Float32BufferAttribute(bp.map(() => 1).slice(0, bp.length / 3), 1));
      const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(lv, 3)); lg.setAttribute("color", new THREE.Float32BufferAttribute(lc, 3));
      bary.add(new THREE.Points(bg2, ptsMat), new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, depthWrite: false })));
    }
    root.add(bary);
    // liens vers les voisins (selection ou individu simule)
    linkGeo = new THREE.BufferGeometry(); linkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6 * 6), 3)); linkGeo.setDrawRange(0, 0);
    links = new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({ color: col("--amber"), transparent: true, opacity: 0.75 })); root.add(links);
    items.forEach((it, i) => { if (it.lab && show.names) addLabel(it.cur, esc(it.label), it.kind === "ind" ? "ind" : "var", null, i); });
    const dur = reduced || mode === "none" ? 0 : mode === "morph" ? 750 : 1600;
    anim = { t0: performance.now(), dur, mode }; if (!dur) anim.t0 -= 1e5;
    axes.scale.setScalar(dur && mode !== "morph" ? 0.001 : 1); arrows.children.forEach(g => g.scale.setScalar(dur && mode !== "morph" ? 0.001 : 1));
    selected = -1; selNb = []; hover = -1; tip.hidden = true; focusSet = null;
    buildNet(); buildTerrain(); buildUnc(); buildCal();
    if (g0) setGhost(g0.F, g0.nb);
    if (selSet && selSet.size) setSelection(selSet, selIso);
    if (first) { first = false; if (!reduced) { const [p, u] = VIEWS["3d"]; camAnim = { t0: performance.now(), dur: 2600, p0: camera.position.clone(), u0: camera.up.clone(), p1: p.clone().setLength(25), u1: u.clone() }; } else { camera.position.copy(VIEWS["3d"][0]).setLength(25); camera.lookAt(0, 0, 0); } }
  }
  function addLabel(pos, html, kind, obj = null, idx = -1) { const d = document.createElement("div"); d.className = "lbl " + kind; d.innerHTML = html; layer.appendChild(d); const L = { el: d, pos, kind, obj, idx, x: 0, y: 0, op: 0, vis: false }; labels.push(L); return L; }
  function setShow(k, v) {
    show[k] = v; if (!ok) return;
    if (k === "arrows") arrows.visible = v; if (k === "sphere") sphere.visible = v; if (k === "drops") drops.visible = dots.visible = v && Math.min(state.res.q, 3) >= 3;
    if (k === "names" || k === "bary") build(state.res, "none");
    if (k === "net") { clear(net); net = null; buildNet(); } if (k === "dens") { clear(terrain); terrain = null; buildTerrain(); } if (k === "unc") { clear(unc); unc = null; buildUnc(); }
  }
  function setView(v) { if (!ok) return; if (mode !== "normal") exitHyper(); view = v; setTimeout(buildCal, 0); const [p, u] = VIEWS[v]; camAnim = { t0: performance.now(), dur: reduced ? 0 : 1000, p0: camera.position.clone(), u0: camera.up.clone(), p1: p.clone().setLength(v === "3d" ? 25 : 27), u1: u.clone() }; syncViews(v); }
  function bindControls() {
    const c = renderer.domElement, ptrs = new Map();
    c.addEventListener("pointerdown", e => { c.setPointerCapture(e.pointerId);
      if (e.button === 0 && (e.shiftKey || lassoOn)) { const r = c.getBoundingClientRect(); lasso = { pts: [[e.clientX - r.left, e.clientY - r.top]], add: e.ctrlKey || e.metaKey }; drawLasso(); return; } ptrs.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY, moved: 0 }; idle = performance.now(); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
    c.addEventListener("pointermove", e => {
      const r = c.getBoundingClientRect(); pointer.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (lasso) { const l = lasso.pts.at(-1), x = e.clientX - r.left, y = e.clientY - r.top; if (Math.hypot(x - l[0], y - l[1]) > 3) { lasso.pts.push([x, y]); drawLasso(); } return; }
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom(pinch / d); pinch = d; return; }
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); if (drag.moved > 3) { rotate(dx, dy); tip.hidden = true; } idle = performance.now(); return; }
      pick(e.clientX - r.left, e.clientY - r.top);
    });
    const up = e => {
      if (lasso) { const L = lasso; lasso = null; drawLasso(); ptrs.delete(e.pointerId); if (L.pts.length > 4) { const idx = screenPoints().filter(p => inPoly(p.x, p.y, L.pts)).map(p => p.i); Sel.set(idx, "lasso", L.add ? "add" : "replace"); if (idx.length) toast(`${pl(idx.length, "point sélectionné", "points sélectionnés")} au lasso.`); } return; }
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
      if (drag && drag.moved < 5 && e.type === "pointerup") { if (hover >= 0 && (e.ctrlKey || e.metaKey) && items[hover].kind === mk()) Sel.set([items[hover].i], "clic", "toggle"); else { select(hover); if (hover < 0 && state.sel.size) Sel.clear(); } }
      drag = null; };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up); c.addEventListener("pointerleave", () => { if (!drag) { setSize(hover, 1); hover = -1; tip.hidden = true; } });
    c.addEventListener("wheel", e => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0012)); idle = performance.now(); }, { passive: false });
    c.addEventListener("dblclick", () => mode === "normal" && setView("3d"));
  }
  function rotate(dx, dy) {
    camAnim = null; if (view !== "3d") { view = "3d"; syncViews("3d"); }
    const dir = camera.position.clone().negate().normalize(), right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(camera.up.clone().normalize(), -dx * 0.006).multiply(new THREE.Quaternion().setFromAxisAngle(right, -dy * 0.006));
    camera.position.applyQuaternion(q); camera.up.applyQuaternion(q).normalize(); camera.lookAt(0, 0, 0);
  }
  function zoom(f) { camera.position.setLength(clamp(camera.position.length() * f, 9, 80)); }
  function pick(mx, my) {
    if (!pts) return; raycaster.setFromCamera(pointer, camera); const hits = raycaster.intersectObject(pts); let best = -1, bd = 1e9;
    for (const h of hits) { const it = items[h.index]; if (!it || (focusSet && !focusSet.has(h.index))) continue; const d = h.distanceToRay ?? 0; if (d < bd) { bd = d; best = h.index; } }
    if (best !== hover) { const prev = hover; hover = best; setSize(prev, 1); setSize(hover, 1.7); }
    if (best < 0) { tip.hidden = true; return; }
    tip.innerHTML = tipHTML(items[best]); tip.hidden = false; const tw_ = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = clamp(mx + 16, 8, W - tw_ - 8) + "px"; tip.style.top = clamp(my + 14, 8, H - th - 8) + "px";
  }
  const mk = () => (state.res?.method === "AFC" ? "row" : "ind");
  const baseSize = i => items[i].size * (selSet && selSet.size && items[i].kind === mk() && selSet.has(items[i].i) ? 1.35 : 1);
  function setSize(i, f) { if (i < 0 || !geo || !items[i]) return; geo.attributes.size.array[i] = baseSize(i) * (i === selected ? 1.9 : f); geo.attributes.size.needsUpdate = true; }
  function applyAlpha() {
    if (!geo) return; const al = geo.attributes.alpha.array, sz = geo.attributes.size.array, has = selSet && selSet.size > 0, m = mk();
    items.forEach((it, i) => { let a = focusSet && !focusSet.has(i) ? 0.1 : 1; const main = it.kind === m; if (mode === "embed" && (!main || (embMask && !embMask.has(it.i)))) a = 0;
      if (has) { if (!(main && selSet.has(it.i))) a *= main ? (selIso ? 0 : 0.13) : 0.3; } al[i] = a; sz[i] = baseSize(i) * (i === selected ? 1.9 : 1); });
    geo.attributes.alpha.needsUpdate = true; geo.attributes.size.needsUpdate = true;
    labels.forEach(L => { if (L.idx < 0) return; const it = items[L.idx]; L.dim = !!((focusSet && !focusSet.has(L.idx)) || (has && it && it.kind === m && !selSet.has(it.i)) || (mode === "embed" && it && it.kind !== m)); L.hide = !!(has && selIso && it && it.kind === m && !selSet.has(it.i)); });
  }
  function setSelection(set, iso) {
    selSet = set; selIso = !!iso; if (!ok || !geo) return; const m = mk();
    labels = labels.filter(L => { if (L.selLbl) { L.el.remove(); return false; } return true; });
    if (set && set.size && set.size <= 40) items.forEach((it, i) => { if (it.kind === m && set.has(it.i) && !(it.lab && show.names)) { const L = addLabel(it.cur, esc(it.label), "ind sel", null, i); L.selLbl = true; } });
    applyAlpha();
  }
  function screenPoints() { const v = new THREE.Vector3(), m = mk(); return items.map(it => { if (it.kind !== m) return null; v.copy(it.cur).project(camera); if (v.z > 1) return null; return { i: it.i, x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H }; }).filter(Boolean); }
  function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; } return c; }
  function drawLasso() { if (!lasso) { lassoSvg.innerHTML = ""; return; } lassoSvg.innerHTML = `<path d="M${lasso.pts.map(p => p.map(v => v.toFixed(1)).join(",")).join("L")}Z"/>`; }
  function setLasso(on) { lassoOn = on; el.classList.toggle("lassoing", on); }
  function nearest(i, k = 3) { const it = items[i]; return items.map((o, j) => ({ j, d: o.kind === it.kind && j !== i ? o.target.distanceTo(it.target) : Infinity })).sort((a, b) => a.d - b.d).slice(0, k).filter(o => isFinite(o.d)).map(o => o.j); }
  function select(i) {
    const prev = selected; selected = i; setSize(prev, 1); if (i >= 0) setSize(i, 1.9);
    selNb = i >= 0 ? nearest(i) : []; UI.fiche(i >= 0 ? items[i] : null, selNb.map(j => items[j]));
  }
  function selectRef(kind, i) { const idx = items.findIndex(it => it.kind === kind && it.i === i); if (idx >= 0) select(idx); }
  function setGhost(F, nb = []) {
    if (!ok) return;
    if (!F) { if (ghost) { clear(ghost.group); ghost.label.el.remove(); labels = labels.filter(l => l !== ghost.label); ghost = null; } return; }
    const target = world(F);
    if (!ghost) {
      const group = new THREE.Group(), g = new THREE.BufferGeometry(), c = col("--amber");
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3)); g.setAttribute("color", new THREE.BufferAttribute(new Float32Array([c.r, c.g, c.b]), 3)); g.setAttribute("size", new THREE.BufferAttribute(new Float32Array([1.7]), 1)); g.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array([1]), 1));
      const pt = new THREE.Points(g, ptsMat); pt.renderOrder = 5;
      const trailGeo = new THREE.BufferGeometry(), TN = 70; trailGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TN * 3), 3)); const tc = new Float32Array(TN * 3), bgc = col("--bg-2"); for (let i = 0; i < TN; i++) { const f = i / (TN - 1); tc.set([bgc.r + (c.r - bgc.r) * f, bgc.g + (c.g - bgc.g) * f, bgc.b + (c.b - bgc.b) * f], i * 3); } trailGeo.setAttribute("color", new THREE.BufferAttribute(tc, 3));
      const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
      const stemGeo = new THREE.BufferGeometry(); stemGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
      const stem = new THREE.Line(stemGeo, new THREE.LineDashedMaterial({ color: c, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.8 }));
      group.add(trail, stem, pt); root.add(group);
      const start = target.clone(); ghost = { group, g, trailGeo, stemGeo, stem, cur: start, target, trailPts: Array.from({ length: TN }, () => start.clone()), label: addLabel(start, "Nouvel individu", "ghost"), F, nb };
      ghost.label.pos = ghost.cur;
    }
    ghost.target = target; ghost.F = F; ghost.nb = nb;
  }
  function setFocus(f) {   // tour guide : met en avant un axe et des elements
    if (!ok || !geo) return; focusSet = f?.idx ? new Set(f.idx) : null;
    applyAlpha();
    beamMats.forEach((m, k) => { const on = !f || f.axis == null || f.axis === k || (f.axis2 != null && f.axis2 === k); m[0].opacity = on ? 0.95 : 0.15; m[1].opacity = on ? 0.13 : 0.02; });
    if (f && "arrows" in f) arrows.visible = f.arrows && show.arrows; else arrows.visible = show.arrows;
  }
  function idxOf(kind, list) { const pos = new Map(); items.forEach((it, j) => { if (it.kind === kind) pos.set(it.i, j); }); return list.map(i => pos.get(i)).filter(j => j !== undefined); }
  function updateDrops() {
    if (!dropGeo) return; const dp = dropGeo.attributes.position.array, tp = dotGeo.attributes.position.array;
    items.forEach((it, i) => { dp.set([it.cur.x, it.cur.y, it.cur.z, it.cur.x, 0, it.cur.z], i * 6); tp.set([it.cur.x, 0, it.cur.z], i * 3); });
    dropGeo.attributes.position.needsUpdate = true; dotGeo.attributes.position.needsUpdate = true;
  }
  function renderFrame() { if (useBloom) composer.render(); else renderer.render(scene, camera); }
  function loop(t) {
    requestAnimationFrame(loop); if (!ok) return;
    const time = (t - t0) / 1000; starMat.uniforms.uTime.value = time; sweepMat.uniforms.uTime.value = time; terrainMat.uniforms.uTime.value = time;
    const cyc = (time % 4.6) / 4.6; scanRing.scale.setScalar(0.3 + cyc * 9.3); scanRing.material.opacity = (1 - cyc) * (dark ? 0.55 : 0.3);
    if (geo) {
      if (anim) { const pos = geo.attributes.position.array; let done = true;
        items.forEach((it, i) => { const k = anim.dur ? clamp((t - anim.t0 - it.delay) / anim.dur, 0, 1) : 1; if (k < 1) done = false; it.cur.lerpVectors(it.from, it.target, ease(k)); pos.set([it.cur.x, it.cur.y, it.cur.z], i * 3); });
        geo.attributes.position.needsUpdate = true; geo.boundingSphere = null; updateDrops();
        const ka = anim.dur ? clamp((t - anim.t0) / 1000, 0, 1) : 1, kb = anim.dur ? clamp((t - anim.t0 - 600) / 1000, 0, 1) : 1;
        if (anim.mode !== "morph") { axes.scale.setScalar(Math.max(ease(ka), 0.001)); ticks.visible = ka >= 1; arrows.children.forEach(g => g.scale.setScalar(Math.max(ease(kb), 0.001))); }
        bary.visible = false; if (done && ka >= 1 && kb >= 1) { anim = null; bary.visible = show.bary && mode === "normal"; } }
      if (mode === "tour" || mode === "anat") updateHyper(t); else if (mode === "embed") updateEmb();
      updateNet(mode === "normal" || mode === "tree" ? scale : mode === "embed" ? null : hyp.curSc || scale);
      if (treeG && treeG.scale.y < 1) treeG.scale.y = Math.max(0.001, reduced ? 1 : ease(clamp((performance.now() - treeT0) / 1500, 0, 1)));
      if (selected >= 0) { geo.attributes.size.array[selected] = items[selected].size * 1.9 * (1 + 0.14 * Math.sin(time * 4)); geo.attributes.size.needsUpdate = true; }
      // liens : selection puis individu simule
      const lp = linkGeo.attributes.position.array; let nl = 0;
      const from = ghost ? ghost.cur : selected >= 0 ? items[selected].cur : null, to = ghost ? ghost.nb : selNb;
      if (from) to.slice(0, 3).forEach(j => { const o = items[j]; if (!o) return; lp.set([from.x, from.y, from.z, o.cur.x, o.cur.y, o.cur.z], nl * 6); nl++; });
      linkGeo.setDrawRange(0, nl * 2); linkGeo.attributes.position.needsUpdate = true; links.material.opacity = 0.45 + 0.3 * Math.sin(time * 3);
    }
    if (ghost) {
      ghost.cur.lerp(ghost.target, reduced ? 1 : 0.16); ghost.g.attributes.position.array.set([ghost.cur.x, ghost.cur.y, ghost.cur.z]); ghost.g.attributes.position.needsUpdate = true;
      ghost.g.attributes.size.array[0] = 1.7 * (1 + 0.18 * Math.sin(time * 5)); ghost.g.attributes.size.needsUpdate = true;
      ghost.trailPts.shift(); ghost.trailPts.push(ghost.cur.clone()); const ta = ghost.trailGeo.attributes.position.array; ghost.trailPts.forEach((p, i) => ta.set([p.x, p.y, p.z], i * 3)); ghost.trailGeo.attributes.position.needsUpdate = true;
      ghost.stemGeo.attributes.position.array.set([0, 0, 0, ghost.cur.x, ghost.cur.y, ghost.cur.z, ghost.cur.x, 0, ghost.cur.z]); ghost.stemGeo.attributes.position.needsUpdate = true; ghost.stem.computeLineDistances();
    }
    if (camAnim) { const k = camAnim.dur ? clamp((t - camAnim.t0) / camAnim.dur, 0, 1) : 1, e = k < 1 ? 1 - Math.pow(1 - k, 3) : 1; const len = camAnim.p0.length() + (camAnim.p1.length() - camAnim.p0.length()) * e;
      camera.position.lerpVectors(camAnim.p0, camAnim.p1, e).setLength(len); camera.up.lerpVectors(camAnim.u0, camAnim.u1, e).normalize(); camera.lookAt(0, 0, 0); if (k >= 1) camAnim = null; }
    else if (show.rotate && view === "3d" && !drag && t - idle > 2500 && !Tour.active) { const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.0015); camera.position.applyQuaternion(q); camera.up.applyQuaternion(q); camera.lookAt(0, 0, 0); }
    stars.rotation.y += 0.0002; if (hsphere.visible) { hsphere.rotation.y += 0.0012; hsphere.rotation.x += 0.0005; } renderFrame();
    // etiquettes HTML
    const v = new THREE.Vector3(), camD = camera.position.length();
    labels.forEach(L => {
      if (L.hide || (L.obj && !L.obj.visible) || (L.obj?.parent && !L.obj.parent.visible) || (L.kind === "tick" && !ticks?.visible) || (mode !== "normal" && (L.kind === "axis" || L.kind === "bary" || L.kind === "cal" || L.kind === "calt"))) { L.el.style.opacity = 0; L.vis = false; return; }
      v.copy(L.idx >= 0 ? items[L.idx].cur : L.pos); if (L.obj && L.kind === "var") v.multiplyScalar(L.obj.scale.x);
      const depth = v.distanceTo(camera.position); v.project(camera); if (v.z > 1) { L.el.style.opacity = 0; L.vis = false; return; }
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H, dx = L.kind === "axis" ? -24 : L.kind === "tick" ? -6 : L.kind === "bary" ? -20 : 8;
      L.x = x + dx; L.y = y - 10; L.op = L.dim ? 0.08 : L.kind === "ray" ? clamp((L.fade - 0.12) / 0.45, 0, 1) : L.kind === "axis" || L.kind === "ghost" || L.kind === "bary" || L.kind === "cls" || L.kind === "cut" || L.kind === "calt" ? 1 : L.kind === "cal" ? 0.95 : clamp(1.35 - (depth - camD + 10) / 22, 0.22, 1); L.vis = L.op > 0.01;
      L.el.style.transform = `translate(${L.x}px,${L.y}px)`; L.el.style.opacity = L.op;
    });
    // gizmo d'orientation et telemetrie
    if (++gizmoTick % 2 === 0) drawGizmo();
    frames++; if (t - fpsT > 500) { fps = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; drawTele(); }
  }
  function drawGizmo() {
    if (!state.res) return; if (mode !== "normal") { gizmo.innerHTML = ""; return; } const q = camera.quaternion.clone().invert(), dims = Math.min(state.res.q, 3);
    const ax = range(dims).map(k => { const d = DIRS[k].clone().applyQuaternion(q); return { k, x: d.x * 30, y: -d.y * 30, z: d.z }; }).sort((a, b) => a.z - b.z);
    gizmo.innerHTML = `<circle r="44" fill="color-mix(in srgb, var(--bg) 55%, transparent)" stroke="var(--line)"/>` + ax.map(a => `<line x1="${-a.x * .5}" y1="${-a.y * .5}" x2="0" y2="0" stroke="var(--a${a.k + 1})" stroke-width="1.5" opacity=".35"/><line x1="0" y1="0" x2="${a.x}" y2="${a.y}" stroke="var(--a${a.k + 1})" stroke-width="2.5" stroke-linecap="round"/><circle cx="${a.x}" cy="${a.y}" r="8" fill="var(--a${a.k + 1})"/><text x="${a.x}" y="${a.y + 3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--bg)" font-family="JetBrains Mono, monospace">${a.k + 1}</text>`).join("");
  }
  function drawTele() {
    const r = state.res; if (!r || !tele) return; const e = r.engine, okTrace = Math.abs(e.trace - e.traceRef) < 1e-6 * Math.max(1, e.traceRef);
    tele.innerHTML = `<b>${fps}</b> FPS · <b>${renderer.info.render.calls}</b> appels GPU · <b>${items.length}</b> points · bloom <b>${useBloom ? "on" : "off"}</b><br>` +
      `${e.alg} · <b>${e.mat}</b> · ${e.sweeps} balayages · <b>${fr(e.ms, 2)} ms</b><br>` +
      `Σλ = <b>${fr(e.trace, 4)}</b> <span class="${okTrace ? "ok" : ""}">${okTrace ? "✓ trace" : "≈"}</span> · ‖VᵀV − I‖ = <b>${sci(e.ortho)}</b>` +
      (hyp ? `<br>projection <b>R<sup>${hyp.d}</sup> → R³</b> · ‖BᵀB − I‖ = <b>${sci(orthoErr(range(hyp.d).map(i => [hyp.B[0][i], hyp.B[1][i], hyp.B[2][i]])))}</b>` : net ? `<br>arbre couvrant : <b>${netEdges.length}</b> liens calculés dans <b>R<sup>${r.q}</sup></b>` : "");
  }
  /* ---------- reseau : arbre couvrant minimal calcule dans l'espace complet */
  function buildNet() {
    const res = state.res; if (!show.net || !res || !items.length) return; const kind = res.method === "AFC" ? "row" : "ind", all = range(items.length).filter(i => items[i].kind === kind), main = all.length > 2500 ? sampleRows(all.length, 2500, 41).map(k => all[k]) : all;   // arbre de Prim en O(m^2) : 2 500 points au plus
    netEdges = mstEdges(main.map(i => items[i].v)).map(([a, b, d]) => [main[a], main[b], d]); netCols = [col("--a2"), col("--a1")];
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(netEdges.length * 6), 3)); g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(netEdges.length * 6), 3));
    net = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: dark ? 0.9 : 0.8, depthWrite: false, blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending })); net.renderOrder = 2; root.add(net);
  }
  function updateNet(sc) {    // couleur = fidelite locale : distance a l'ecran / distance reelle (cyan fidele, corail comprime)
    if (!net) return; const p = net.geometry.attributes.position.array, c = net.geometry.attributes.color.array, tmp = new THREE.Color();
    netEdges.forEach(([a, b, d], e) => { const A = items[a].cur, B = items[b].cur; p.set([A.x, A.y, A.z, B.x, B.y, B.z], e * 6);
      const rho = d > 1e-9 && sc ? clamp(A.distanceTo(B) / (d * sc), 0, 1) : 1; tmp.copy(netCols[0]).lerp(netCols[1], 1 - rho); c.set([tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b], e * 6); });
    net.geometry.attributes.position.needsUpdate = true; net.geometry.attributes.color.needsUpdate = true;
  }
  /* ---------- relief : densite du nuage projete sur le plan 1-2 */
  function buildTerrain() {
    const res = state.res; if (!show.dens || !res || res.q < 2 || mode !== "normal") return; const kind = res.method === "AFC" ? "row" : "ind", main = items.filter(it => it.kind === kind); if (main.length < 3) return;
    const smp = main.length > 4000 ? sampleRows(main.length, 4000, 43).map(k => main[k]) : main;   // densite estimee sur 4 000 points au plus (estimateur sans biais de la forme)
    const K = kdeModel(smp.map(it => it.v[0]), smp.map(it => it.v[1]), res.method === "AFC" ? smp.map(it => res.r[it.i]) : smp.map(() => 1));
    const N = 121, g = new THREE.PlaneGeometry(20, 20, N - 1, N - 1); g.rotateX(-Math.PI / 2); const P = g.attributes.position.array, H = new Float32Array(P.length / 3); let mx = 0;
    for (let i = 0; i < H.length; i++) { H[i] = K.at(P[i * 3] / scale, -P[i * 3 + 2] / scale); if (H[i] > mx) mx = H[i]; }
    for (let i = 0; i < H.length; i++) { H[i] /= mx || 1; P[i * 3 + 1] = -10.8 + H[i] * 3.6; }
    g.setAttribute("h", new THREE.BufferAttribute(H, 1)); terrain = new THREE.Mesh(g, terrainMat); terrain.renderOrder = 1; root.add(terrain);
  }
  /* ---------- incertitude : bootstrap des coordonnees des variables, aligne par Procrustes */
  function buildUnc() {
    const res = state.res; if (!show.unc || !res || res.method !== "ACP" || mode !== "normal") return; const Bs = uncCache(res), n = Bs.length * res.p; if (!n) return;
    const pos = new Float32Array(n * 3), cl = new Float32Array(n * 3); let o = 0;
    Bs.forEach(C => C.forEach((c, j) => { const w = world(c.map(x => x * arrowR0)), cc = col(`--a${dominantAxis(res.vcos2[j], res.nAxes) + 1}`); pos.set([w.x, w.y, w.z], o * 3); cl.set([cc.r, cc.g, cc.b], o * 3); o++; }));
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(cl, 3)); g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(n).fill(0.2), 1)); g.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(n).fill(dark ? 0.4 : 0.55), 1));
    unc = new THREE.Points(g, ptsMat); unc.renderOrder = 2; root.add(unc);
  }

  /* ---------- hyperespace : Grand Tour et anatomie de l'ACP */
  const easeIO = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const canHyper = kind => ok && !!state.res && (kind === "anat" ? state.res.method === "ACP" && state.res.q >= 3 : state.res.q >= 4);
  function startHyper(kind = "tour") {
    if (!canHyper(kind)) { toast(kind === "anat" ? "L'anatomie est réservée à l'ACP (au moins 3 axes)." : "Il faut au moins 4 dimensions pour un tour de l'hyperespace."); return false; }
    if (Tour.active) Tour.stop(); if (mode !== "normal") dropHyper();
    const res = state.res, d = res.q; anim = null; select(-1); setFocus(null); if (cal) cal.visible = false;
    let mx = 1e-9; items.forEach(it => (mx = Math.max(mx, Math.hypot(...it.v))));
    hyp = { kind, d, sc: 9 / mx, sc0: scale, curSc: scale, t0: performance.now(), B: pcaFrame(d), path: null, playing: true, target: null, info: 0, step: -1, rays: hasQ(res) ? res.V.slice(0, res.p).map(r => r.slice(0, d)) : null };
    mode = kind; [axes, ticks, arrows, sphere, drops, dots, bary, terrain, unc].forEach(o => o && (o.visible = false)); hsphere.visible = true; $("#toggles").hidden = true;
    view = "3d"; const [p0, u0] = VIEWS["3d"]; camAnim = { t0: performance.now(), dur: reduced ? 0 : 900, p0: camera.position.clone(), u0: camera.up.clone(), p1: p0.clone().setLength(27), u1: u0.clone() };
    buildRays(); syncViews(kind === "tour" ? "hyper" : "anat");
    $("#stageEyebrow").textContent = kind === "tour" ? `Hyperespace · R${d} → R³ · ${res.method}` : "Hyperespace · anatomie en 4 étapes · ACP";
    $("#stageTitle").textContent = kind === "tour" ? `Le nuage vu depuis ses ${d} dimensions` : "Comment l'ACP construit ses axes";
    if (kind === "tour") nextLeg(); else { anatPrep(); anatGo(0); }
    renderHyCard(); return true;
  }
  function dropHyper() {
    if (treeG) { clear(treeG); treeG = null; } labels = labels.filter(L => { if (L.kind === "cls" || L.kind === "cut") { L.el.remove(); return false; } return true; }); embName = null;
    mode = "normal"; if (rays) { clear(rays); rays = null; } if (hyp?.rayLabels) { hyp.rayLabels.forEach(L => L.el.remove()); labels = labels.filter(L => L.kind !== "ray"); }
    clearTimeout(hyp?.timer); hyp = null; hsphere.visible = false; hyCard.hidden = true; $("#toggles").hidden = false; syncViews(view);
    if (state.res && typeof renderHeader === "function") renderHeader();
  }
  function exitHyper() { if (mode === "normal") return; dropHyper(); if (state.res) build(state.res, "morph"); }
  function legTo(B1, dur, onEnd) { const p = framePath(hyp.B, B1); Object.assign(hyp, { path: p, B1, pathT0: performance.now(), pathDur: dur ?? clamp(p.span / 0.3 * 1000, 2400, 7000), onEnd }); }
  function nextLeg() { hyp.target = null; legTo(randFrame(hyp.d, Math.random), null, () => hyp && hyp.kind === "tour" && hyp.target === null && nextLeg()); }
  function toPCA() { if (!hyp) return; hyp.target = "pca"; if (!hyp.playing) togglePlay(); legTo(pcaFrame(hyp.d), 4200, () => { if (hyp) { hyp.target = "arrived"; renderHyCard(); } }); }
  function togglePlay() {
    if (!hyp) return; const now = performance.now();
    if (hyp.playing) { hyp.playing = false; hyp.pauseT = now; clearTimeout(hyp.timer); }
    else { hyp.playing = true; if (hyp.pathT0) hyp.pathT0 += now - hyp.pauseT; if (hyp.stepT0) hyp.stepT0 += now - hyp.pauseT; if (hyp.kind === "anat") anatSchedule(); }
  }
  function buildRays() {
    const res = state.res; if (!hyp.rays) return; const p = hyp.rays.length, cl = new Float32Array(p * 6), tc = new Float32Array(p * 3);
    res.vars.forEach((_, j) => { const c = col(`--a${dominantAxis(res.vcos2[j], res.nAxes) + 1}`); cl.set([c.r * 0.2, c.g * 0.2, c.b * 0.2, c.r, c.g, c.b], j * 6); tc.set([c.r, c.g, c.b], j * 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p * 6), 3)); g.setAttribute("color", new THREE.BufferAttribute(cl, 3));
    const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p * 3), 3)); tg.setAttribute("color", new THREE.BufferAttribute(tc, 3)); tg.setAttribute("size", new THREE.BufferAttribute(new Float32Array(p).fill(0.7), 1)); tg.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(p).fill(1), 1));
    rays = new THREE.Group(); rays.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false })), new THREE.Points(tg, ptsMat)); root.add(rays);
    hyp.rayLabels = res.vars.map(v => { const L = addLabel(new THREE.Vector3(), esc(v), "ray"); L.fade = 0; return L; });
  }
  function updateRays() {
    if (!rays) return; const lp = rays.children[0].geometry.attributes.position.array, tp = rays.children[1].geometry.attributes.position.array, B = hyp.B, Lr = 8.4;
    hyp.rays.forEach((u, j) => { const x = dot(u, B[0]), y = dot(u, B[1]), z = dot(u, B[2]); lp.set([0, 0, 0, x * Lr, z * Lr, -y * Lr], j * 6); tp.set([x * Lr, z * Lr, -y * Lr], j * 3);
      const L = hyp.rayLabels[j]; L.pos.set(x * Lr * 1.08, z * Lr * 1.08, -y * Lr * 1.08); L.fade = Math.hypot(x, y, z); });
    rays.children[0].geometry.attributes.position.needsUpdate = true; rays.children[1].geometry.attributes.position.needsUpdate = true;
  }
  function anatPrep() {
    const res = state.res, used = [], abc = range(3).map(k => { let best = -1; res.coord.forEach((c, j) => { if (!used.includes(j) && (best < 0 || Math.abs(c[k]) > Math.abs(res.coord[best][k]))) best = j; }); used.push(best); return best; });
    const Eabc = gsCols(abc.map(j => res.V[j].slice(0, hyp.d))), raw = items.map(it => abc.map(j => res.X[it.i][j])), cen = items.map(it => abc.map(j => res.X[it.i][j] - res.mu[j]));
    const g0 = 9 / maxOf(raw.flat().map(Math.abs), 1e-12), g1 = 9 / maxOf(cen.flat().map(Math.abs), 1e-12), W = v => new THREE.Vector3(v[0], v[2], -v[1]);
    hyp.abc = abc; hyp.Eabc = Eabc; hyp.stages = [raw.map(v => W(v.map(x => x * g0))), cen.map(v => W(v.map(x => x * g1))), items.map(it => W(range(3).map(i => dot(it.v, Eabc[i]) * hyp.sc)))];
    hyp.B = Eabc; hyp.sc0 = hyp.sc;
  }
  const ANAT = [3600, 3400, 3600];
  function anatGo(s) {
    if (!hyp) return; if (s >= 4) { exitHyper(); return; } s = Math.max(0, s); clearTimeout(hyp.timer); hyp.step = s; hyp.stepT0 = performance.now(); hyp.from = items.map(it => it.cur.clone()); hyp.path = null; hyp.B = hyp.Eabc;
    if (s === 3) legTo(pcaFrame(hyp.d), 5200);
    if (hyp.playing) anatSchedule(); renderHyCard();
  }
  function anatSchedule() { clearTimeout(hyp.timer); const s = hyp.step, left = (s === 3 ? 5200 + 3400 : 1500 + ANAT[s]) - (performance.now() - hyp.stepT0); hyp.timer = setTimeout(() => hyp && hyp.playing && anatGo(s + 1), Math.max(left, 300)); }
  function hyCmd(c) {
    if (c === "exit") return exitHyper(); if (!hyp) return;
    if (c === "play") togglePlay(); else if (c === "pca") toPCA(); else if (c === "next") hyp.kind === "tour" ? nextLeg() : anatGo(hyp.step + 1); else if (c === "prev") anatGo(hyp.step - 1); else if (c === "exit") return exitHyper();
    renderHyCard();
  }
  function updateHyper(t) {
    const h = hyp, pos = geo.attributes.position.array, now = h.playing ? t : h.pauseT;
    if (h.path) { const k = clamp((now - h.pathT0) / h.pathDur, 0, 1); h.B = h.path.at(h.target === null && h.kind === "tour" ? k : easeIO(k)); if (k >= 1 && h.playing) { h.B = h.B1; h.path = null; const cb = h.onEnd; h.onEnd = null; cb && cb(); } }
    if (!hyp) return; const sc = h.sc0 + (h.sc - h.sc0) * ease(clamp((t - h.t0) / 900, 0, 1)); h.curSc = sc;
    if (h.kind === "anat" && h.step < 3) { const k = ease(clamp((now - h.stepT0) / 1500, 0, 1)), tg = h.stages[h.step]; items.forEach((it, i) => { it.cur.lerpVectors(h.from[i], tg[i], k); pos.set([it.cur.x, it.cur.y, it.cur.z], i * 3); }); }
    else items.forEach((it, i) => { const v = it.v; let x = 0, y = 0, z = 0; for (let k = 0; k < h.d; k++) { x += v[k] * h.B[0][k]; y += v[k] * h.B[1][k]; z += v[k] * h.B[2][k]; } it.cur.set(x * sc, z * sc, -y * sc); pos.set([it.cur.x, it.cur.y, it.cur.z], i * 3); });
    geo.attributes.position.needsUpdate = true; geo.boundingSphere = null; updateRays();
    if (++h.info % 5 === 0) updateHyCard();
  }
  function renderHyCard() {
    if (!hyp) return; const r = state.res, h = hyp, max = r.cum[2] ?? 100;
    const play = h.playing ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>` : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>`;
    const gauge = `<div class="gauge"><div class="gl"><span>Inertie visible</span><b id="hyIn">—</b></div><div class="gb"><i id="hyBar"></i><em style="left:${max}%" title="Maximum atteint par l'ACP"></em></div><div class="gl sm"><span>0 %</span><span>max (ACP) ${pc(max)}</span></div></div>`;
    const bars = `<div class="axbars" id="hyAx" title="Présence de chaque axe principal dans la vue (0 à 100 %)">${r.vals.slice(0, Math.min(r.q, 10)).map((_, k) => `<div><i style="background:${k < 3 ? `var(--a${k + 1})` : "var(--faint)"}"></i><span>${k + 1}</span></div>`).join("")}</div>`;
    let head, text, ctl;
    if (h.kind === "tour") {
      head = `TOUR DE L'HYPERESPACE · R<sup>${h.d}</sup> → R³`;
      text = h.target === "arrived" ? `<b>Arrivé : c'est le point de vue de l'ACP.</b> Aucune autre projection orthonormée en 3D ne montre plus d'inertie (${pc(max)}).`
        : h.target === "pca" ? `<b>Convergence vers l'ACP…</b> La jauge monte vers le maximum possible.`
        : `Le nuage est vu sous des angles tirés au hasard dans ses ${h.d} dimensions : chaque image est une projection orthonormée exacte${h.rays ? ", les rayons donnent la direction de chaque variable" : ""}.`;
      ctl = `<button class="btn sm" type="button" data-hy="play" aria-label="${h.playing ? "Pause" : "Lecture"}">${play}</button><button class="btn sm" type="button" data-hy="next">Nouvel angle</button><button class="btn sm prime" type="button" data-hy="pca">Converger vers l'ACP</button><button class="btn sm" type="button" data-hy="exit" aria-label="Quitter l'hyperespace">×</button>`;
    } else {
      const [a, b, c] = h.abc.map(j => esc(r.vars[j])), big = h.abc.reduce((m, j) => (Math.max(Math.abs(r.min[j]), Math.abs(r.max[j])) > Math.max(Math.abs(r.min[m]), Math.abs(r.max[m])) ? j : m), h.abc[0]);
      const rng = j => { const d = Math.abs(r.max[j]) >= 100 ? 0 : 1; return `${fr(r.min[j], d)} à ${fr(r.max[j], d)}`; };
      const steps = [["Données brutes", `${a}, ${b} et ${c} dans leurs unités, à la même échelle : <b>${esc(r.vars[big])}</b> (de ${rng(big)}) écrase les autres. Sans réduction, la variable aux plus grands nombres dominerait l'ACP.`],
        ["Centrer", `On retire la moyenne de chaque variable : le nuage se place autour de son centre de gravité. <span class="mono">x − x̄</span>`],
        ["Réduire", `On divise par l'écart-type : chaque variable pèse 1. Ces 3 variables portent ${pc(300 / r.p)} de l'inertie totale (3 sur ${r.p}). <span class="mono">z = (x − x̄) / s</span>`],
        ["Tourner", `L'ACP ne déforme rien : elle fait tourner le nuage dans ses ${h.d} dimensions jusqu'au point de vue qui montre le plus d'inertie. La jauge passe de ${pc(300 / r.p)} à ${pc(max)}.`]];
      head = `ANATOMIE DE L'ACP · ÉTAPE ${h.step + 1} / 4`; text = `<b>${steps[h.step][0]}.</b> ${steps[h.step][1]}`;
      ctl = `<button class="btn sm" type="button" data-hy="prev" ${h.step === 0 ? "disabled" : ""} aria-label="Étape précédente">←</button><button class="btn sm" type="button" data-hy="play" aria-label="${h.playing ? "Pause" : "Lecture"}">${play}</button><button class="btn sm" type="button" data-hy="next">${h.step === 3 ? "Terminer" : "→"}</button><div class="dots">${range(4).map(i => `<i class="${i <= h.step ? "on" : ""}"></i>`).join("")}</div><button class="btn sm" type="button" data-hy="exit" aria-label="Quitter l'anatomie">×</button>`;
    }
    hyCard.innerHTML = `<div class="hy-l"><div class="step">${head}</div><p>${text}</p><div class="ctl">${ctl}</div></div><div class="hy-r"${h.kind === "anat" && h.step < 2 ? ' style="opacity:.25"' : ""}>${gauge}${bars}</div>`; hyCard.hidden = false; updateHyCard();
  }
  function updateHyCard() {
    if (!hyp) return; const r = state.res, pin = projInertia(r, hyp.B) * 100, pres = axisPresence(r, hyp.B), el = $("#hyIn"), bar = $("#hyBar"); if (!el) return;
    el.textContent = pc(pin); bar.style.width = clamp(pin, 0, 100) + "%"; document.querySelectorAll("#hyAx i").forEach((i, k) => (i.style.height = clamp(pres[k] * 100, 3, 100) + "%"));
  }


  /* ---------- arbre hierarchique (HCPC) deploye au-dessus du plan factoriel 1-2 */
  function showTree(hc) {
    if (!ok || !hc?.ward || !state.res) { toast("Arbre 3D disponible jusqu'à 1 200 individus."); return; }
    if (mode !== "normal") dropHyper(); if (Tour.active) Tour.stop(); select(-1); mode = "tree";
    const W = hc.ward, n = W.n, hm = W.tree.at(-1).h, Hs = h => 10.5 * Math.sqrt(h / hm), m = mk(), P = new Array(2 * n - 1), Y = new Array(2 * n - 1).fill(0), maj = new Array(2 * n - 1), sz = new Array(2 * n - 1).fill(1);
    items.forEach(it => { it.from = it.cur.clone(); it.delay = 0; if (it.kind === m) { it.target = world([it.v[0], it.v[1], 0]); P[it.i] = it.target.clone(); maj[it.i] = hc.labels[it.i]; } else it.target = it.cur.clone(); });
    anim = { t0: performance.now(), dur: reduced ? 0 : 900, mode: "morph" };
    [ticks, arrows, sphere, drops, dots, bary, terrain, unc, cal].forEach(o => o && (o.visible = false)); if (axes.children[2]) axes.children[2].visible = false;
    const pos = [], colr = [], muted = col("--muted"), cut = n - hc.k;
    W.tree.forEach((t, k) => { const id = n + k; sz[id] = sz[t.a] + sz[t.b]; P[id] = P[t.a].clone().multiplyScalar(sz[t.a] / sz[id]).add(P[t.b].clone().multiplyScalar(sz[t.b] / sz[id])); Y[id] = Hs(t.h); maj[id] = maj[t.a] === maj[t.b] ? maj[t.a] : -1;
      const c = k < cut && maj[id] >= 0 ? col(`--g${maj[id] % 10 + 1}`) : muted, A = P[t.a], B = P[t.b], ym = Y[id];
      pos.push(A.x, Y[t.a], A.z, A.x, ym, A.z, B.x, Y[t.b], B.z, B.x, ym, B.z, A.x, ym, A.z, B.x, ym, B.z); for (let q = 0; q < 6; q++) colr.push(c.r, c.g, c.b); });
    treeG = new THREE.Group(); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(colr, 3));
    treeG.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 })));
    const yc = cut > 0 ? (Hs(W.tree[cut - 1].h) + Hs(W.tree[cut].h)) / 2 : Hs(W.tree[0].h) / 2;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(10.8, 96), new THREE.MeshBasicMaterial({ color: col("--amber"), transparent: true, opacity: dark ? 0.07 : 0.1, side: THREE.DoubleSide, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = yc;
    const rim = ring(10.8, "y", col("--amber"), 0.7); rim.position.y = yc; treeG.add(disc, rim); treeG.scale.y = 0.001; treeT0 = performance.now(); root.add(treeG);
    addLabel(new THREE.Vector3(10.2, yc + 0.4, 0), `COUPURE · ${hc.k} CLASSES`, "cut", treeG);
    range(hc.k).forEach(j => { const mem = items.filter(it => it.kind === m && hc.labels[it.i] === j); if (!mem.length) return; const c = mem.reduce((a, it) => a.add(it.target), new THREE.Vector3()).multiplyScalar(1 / mem.length); addLabel(c.add(new THREE.Vector3(0, 0.3, 0)), `<i style="background:var(--g${j % 10 + 1})"></i>Classe ${j + 1} · ${mem.length}`, "cls", treeG); });
    hyCard.innerHTML = `<div class="hy-l"><div class="step">CLASSIFICATION HIÉRARCHIQUE · WARD</div><p><b>${hc.k} classes, ${pc(hc.R2 * 100, 0)} de l'inertie expliquée.</b> Chaque individu est posé à sa place sur le plan 1·2 ; les branches montent jusqu'à leur fusion (hauteur en racine du gain d'inertie). Le disque doré est la coupure.</p><div class="ctl"><button class="btn sm" type="button" data-hy="exit">Revenir à l'espace factoriel</button></div></div>`;
    hyCard.hidden = false; $("#toggles").hidden = true; $("#stageEyebrow").textContent = "Classification hiérarchique sur composantes principales"; $("#stageTitle").textContent = `${hc.k} classes au-dessus du plan 1·2`;
    view = "3d"; const [p0, u0] = VIEWS["3d"]; camAnim = { t0: performance.now(), dur: reduced ? 0 : 1200, p0: camera.position.clone(), u0: camera.up.clone(), p1: p0.clone().setLength(34), u1: u0.clone() }; syncViews("tree");
  }
  /* ---------- projection non lineaire (t-SNE, UMAP) : les points glissent vers leur place */
  // Y peut contenir des trous (projection calculee sur un echantillon) : ces individus sont masques en mode projection
  let embMask = null;
  function setEmbTargets(Y) { const m = mk(), ok = Y.filter(Boolean), c = [0, 1, 2].map(k => mean(ok.map(y => y[k] || 0))); let mx = 1e-9; ok.forEach(y => (mx = Math.max(mx, Math.hypot((y[0] - c[0]), (y[1] - c[1]), ((y[2] || 0) - c[2]))))); const s = 9 / mx;
    embMask = ok.length < Y.length ? new Set(Y.map((y, i) => (y ? i : -1)).filter(i => i >= 0)) : null;
    items.forEach(it => { if (it.kind === m && Y[it.i]) it.target = new THREE.Vector3((Y[it.i][0] - c[0]) * s, ((Y[it.i][2] || 0) - c[2]) * s, -(Y[it.i][1] - c[1]) * s); }); }
  function showEmbedding(Y, name) {
    if (!ok || !state.res) return; if (mode !== "normal" && mode !== "embed") dropHyper(); if (Tour.active) Tour.stop(); select(-1); anim = null; mode = "embed"; embName = name;
    [axes, ticks, arrows, sphere, drops, dots, bary, terrain, unc, cal].forEach(o => o && (o.visible = false)); hsphere.visible = true; setEmbTargets(Y); applyAlpha();
    hyCard.innerHTML = `<div class="hy-l"><div class="step">PROJECTION NON LINÉAIRE · ${esc(name)} 3D</div><p><b>Seuls les voisinages comptent</b> : les axes n'ont pas de sens et les distances entre groupes ne sont pas interprétables. Activez le réseau (touche M) : il relie les vrais voisins calculés dans toutes les dimensions.</p><div class="ctl"><button class="btn sm" type="button" data-hy="exit">Revenir à l'ACP</button><span class="mono muted" id="embProg"></span></div></div>`;
    hyCard.hidden = false; $("#toggles").hidden = true; $("#stageEyebrow").textContent = `Projection ${name} · ${state.res.q} dimensions → 3`; $("#stageTitle").textContent = `Les voisinages du nuage, vus par ${name}`; syncViews("embed");
  }
  function updateEmbedding(Y, final) { if (mode !== "embed") return; setEmbTargets(Y); const p = $("#embProg"); if (p) p.textContent = final ? "optimisation terminée" : "optimisation en cours…"; }
  function updateEmb() { const pos = geo.attributes.position.array, m = mk(); items.forEach((it, i) => { if (it.kind !== m) return; it.cur.lerp(it.target, reduced ? 1 : 0.14); pos.set([it.cur.x, it.cur.y, it.cur.z], i * 3); }); geo.attributes.position.needsUpdate = true; geo.boundingSphere = null; }
  /* ---------- axe gradue : lecture directe d'une variable en unites d'origine (biplot predictif, Gower & Hand 1996) */
  function buildCal() {
    if (cal) { clear(cal); cal = null; labels = labels.filter(L => { if (L.kind === "cal" || L.kind === "calt") { L.el.remove(); return false; } return true; }); }
    const res = state.res; if (!ok || !res || !hasQ(res) || !state.calVar || mode !== "normal") return; const j = res.vars.indexOf(state.calVar); if (j < 0) return;
    const comps = view === "12" ? [0, 1] : view === "13" ? [0, 2] : view === "23" ? [1, 2] : [0, 1, 2], v = [0, 0, 0]; comps.forEach(k => (v[k] = res.V[j][k] || 0)); const nn = v[0] ** 2 + v[1] ** 2 + v[2] ** 2; if (nn < 1e-6) return;
    const mu = res.mu[j], sd = res.sdPop[j], lo = res.min[j], hi = res.max[j], at = x => world(v.map(c => c * ((x - mu) / sd) / nn)), R = 11, c = col("--amber");
    const span = hi - lo, a0 = at(lo - 0.25 * span), a1 = at(hi + 0.25 * span), clampR = p => (p.length() > R ? p.clone().setLength(R) : p);
    cal = new THREE.Group(); cal.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([clampR(a0), clampR(a1)]), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.9 })));
    const step = niceStep(span / 5), dec = step >= 1 ? 0 : step >= 0.1 ? 1 : 2; for (let x = Math.ceil(lo / step) * step; x <= hi + 1e-9; x += step) { const p = at(x); if (p.length() > R) continue; const dot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: c })); dot.position.copy(p); cal.add(dot); addLabel(p.clone(), fr(x, dec), "cal", cal); }
    addLabel(clampR(a1).clone().multiplyScalar(1.04), `${esc(state.calVar)} ↗`, "calt", cal); root.add(cal);
  }

  async function capture() {
    if (!ok) return null; renderFrame(); const dpr = renderer.getPixelRatio(), c = document.createElement("canvas"); c.width = W * dpr; c.height = H * dpr; const g = c.getContext("2d");
    g.fillStyle = cssVar("--bg-2"); g.fillRect(0, 0, c.width, c.height); g.drawImage(renderer.domElement, 0, 0, c.width, c.height); g.scale(dpr, dpr);
    const fonts = { axis: "600 11px JetBrains Mono, monospace", var: "600 11.5px Instrument Sans, sans-serif", ind: "10.5px Instrument Sans, sans-serif", tick: "9.5px JetBrains Mono, monospace", bary: "600 11px Unbounded, sans-serif", ghost: "600 11px JetBrains Mono, monospace" };
    labels.forEach(L => { if (!L.vis || L.op < 0.05) return; const txt = L.el.textContent; g.globalAlpha = L.op; g.font = fonts[L.kind] || fonts.var; const w = g.measureText(txt).width;
      if (L.kind !== "ind" && L.kind !== "tick") { g.fillStyle = L.kind === "ghost" ? cssVar("--amber") : cssVar("--panel-solid"); g.globalAlpha = L.op * 0.85; g.beginPath(); g.roundRect ? g.roundRect(L.x, L.y, w + 14, 20, 6) : g.rect(L.x, L.y, w + 14, 20); g.fill(); g.globalAlpha = L.op; }
      g.fillStyle = L.kind === "ghost" ? cssVar("--bg") : L.kind === "ind" || L.kind === "tick" ? cssVar("--muted") : cssVar("--text"); g.fillText(txt, L.x + (L.kind === "ind" || L.kind === "tick" ? 4 : 7), L.y + 14); });
    g.globalAlpha = 1; g.fillStyle = cssVar("--muted"); g.font = "600 11px Instrument Sans, sans-serif"; g.fillText($("#stageEyebrow").textContent.toUpperCase(), 24, 34);
    g.fillStyle = cssVar("--text"); g.font = "600 26px Unbounded, sans-serif"; g.fillText($("#stageTitle").textContent, 24, 70);
    g.fillStyle = cssVar("--faint"); g.font = "11px JetBrains Mono, monospace"; g.textAlign = "right"; g.fillText(`Prisme · ${new Date().toLocaleDateString("fr-FR")}`, W - 20, H - 18);
    return new Promise(r => c.toBlob(r, "image/png"));
  }
  return { init, build, setView, setShow, applyTheme, select, selectRef, setGhost, setFocus, idxOf, capture, replay: () => state.res && (mode === "normal" ? build(state.res, "project") : exitHyper()),
    startHyper, exitHyper, hyCmd, canHyper, setSelection, setLasso, get lassoOn() { return lassoOn; }, showTree, showEmbedding, updateEmbedding, refreshCal: buildCal, get mode() { return mode; }, get treeScale() { return treeG ? treeG.scale.y : null; }, get lod() { return lod; }, get ok() { return ok; }, show, get items() { return items; } };
})();
function tipHTML(it) {
  const res = state.res, S = Math.min(res.q, 3); let rows = "";
  if (it.kind === "sup") { const v = res.supp.quali.find(q => q.name === it.ref[0]), m = v.mods[it.ref[1]]; return `<b>${esc(it.label)}</b><div class="row"><span>Illustrative · effectif</span><span>${m.n}</span></div>` + range(S).map(k => `<div class="row"><span>Valeur-test axe ${k + 1}</span><span>${frs(m.vtest[k], 1)}</span></div>`).join(""); }
  if (it.kind === "ind" || it.kind === "row") { const F = res.F[it.i]; rows = range(S).map(k => `<div class="row"><span>Axe ${k + 1}</span><span>${frs(F[k])}</span></div>`).join("");
    const c2 = res.method === "AFC" ? res.rcos2[it.i] : res.cos2[it.i]; rows += `<div class="row"><span>cos² plan 1·2</span><span>${fr(c2[0] + (c2[1] || 0))}</span></div>`; }
  else { const G = res.G[it.i]; rows = range(S).map(k => `<div class="row"><span>Axe ${k + 1}</span><span>${frs(G[k])}</span></div>`).join(""); }
  const gi = groupIndex(res);
  const sub = it.kind === "ind" && gi ? `<div class="row"><span>${state.colorMode === "clusters" && state.clusters ? "Classe k-means" : esc(res.color)}</span><span style="font-family:var(--f-body)">${esc(gi.cats[gi.idx[it.i]])}</span></div>` : it.kind === "mod" ? `<div class="row"><span>Effectif</span><span>${res.eff[it.i]}</span></div>` : it.kind === "col" ? `<div class="row"><span>${esc(res.colName)}</span><span style="font-family:var(--f-body)">colonne</span></div>` : "";
  return `<b>${esc(it.label)}</b>${sub}${rows}`;
}
