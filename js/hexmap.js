// An infinite hex-grid canvas, shared by the map viewer (map.html) and the
// map editor (map-editor.html).
//
// Hexes are addressed with axial coordinates (q, r) and can be negative, so
// the grid has no edges: only the hexes that are actually on screen are ever
// worked out or drawn. Pan by dragging, zoom with the wheel / pinch / buttons.

const HEX_BASE = 30;                 // hex size (centre to corner) at zoom 1
const HEX_SQRT3 = Math.sqrt(3);
const HEX_ZOOM_MIN = 0.08;
const HEX_ZOOM_MAX = 3.5;

// the six neighbours (pointy-top hexes), and the direction each one lies in
// on screen (degrees, y pointing down)
const HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const HEX_DIR_ANGLES = [0, -60, -120, 180, 120, 60];

const HEX_VERT = Array.from({ length: 6 }, (_, i) => {
  const a = ((60 * i) - 30) * Math.PI / 180;
  return [Math.cos(a), Math.sin(a)];
});
// the edge of a hex that faces neighbour d runs between two of its corners
const HEX_EDGE = HEX_DIR_ANGLES.map((deg) => [deg - 30, deg + 30].map((d) => {
  const a = d * Math.PI / 180;
  return [Math.cos(a), Math.sin(a)];
}));

function hexKey(q, r) { return `${q},${r}`; }

function parseHexKey(key) {
  const p = key.split(',');
  return [Number(p[0]), Number(p[1])];
}

function axialToWorld(q, r) {
  return { x: HEX_BASE * HEX_SQRT3 * (q + r / 2), y: HEX_BASE * 1.5 * r };
}

function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq + 0, rr + 0]; // "+ 0" turns -0 into 0
}

function worldToAxial(x, y) {
  return hexRound(((HEX_SQRT3 / 3) * x - y / 3) / HEX_BASE, ((2 / 3) * y) / HEX_BASE);
}

// Adds one hexagon to a Path2D. Many hexes go into one big path, and
// closePath() inside a path that large gets extremely slow in the browser
// (3 seconds for 20,000 hexes!), so by default the shape is closed by
// drawing a line back to its first corner instead (16 ms for the same).
// A single outline can use closePath for slightly cleaner corners.
function hexPath(path, cx, cy, s, useClosePath) {
  path.moveTo(cx + HEX_VERT[0][0] * s, cy + HEX_VERT[0][1] * s);
  for (let i = 1; i < 6; i++) path.lineTo(cx + HEX_VERT[i][0] * s, cy + HEX_VERT[i][1] * s);
  if (useClosePath) path.closePath();
  else path.lineTo(cx + HEX_VERT[0][0] * s, cy + HEX_VERT[0][1] * s);
}

class HexMap {
  // opts: onHexClick(q, r, event), onPaint(q, r, erase), onHover(q, r | null)
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.cam = { x: 0, y: 0, zoom: 1 }; // x, y: the world point at the centre of the canvas
    this.regionByKey = new Map();       // "q,r" -> region { colorMain, colorSecondary }
    this.dots = new Map();              // "q,r" -> { color, label }
    this.selection = new Set();         // "q,r" keys highlighted as a selection (editor)
    this.selected = null;               // [q, r] of the single selected hex
    this.hover = null;                  // "q,r" under the mouse
    this.dragMode = 'pan';              // 'pan' | 'paint'
    this.paintErase = false;
    this.showCoords = false;
    this.theme = { bg: '#0d0c0b', grid: 'rgba(168, 159, 144, 0.14)', ink: '#efe6d8', select: '#ffd34d' };
    this.pointers = new Map();
    this.press = null;
    this.gesture = null;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this._raf = null;
    this._bind();
    this.resize();
  }

  // ---- data ------------------------------------------------------------------------------
  // regions: [{ colorMain, colorSecondary, hexes: [[q, r], ...] }]
  setRegions(regions) {
    this.regionByKey = new Map();
    regions.forEach((region) => {
      (region.hexes || []).forEach(([q, r]) => this.regionByKey.set(hexKey(q, r), region));
    });
    this.requestDraw();
  }

  setDots(dots) {
    this.dots = dots;
    this.requestDraw();
  }

  // ---- coordinates ---------------------------------------------------------------------------
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.width / 2) / this.cam.zoom + this.cam.x,
      y: (sy - this.height / 2) / this.cam.zoom + this.cam.y,
    };
  }

  hexAt(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    return worldToAxial(w.x, w.y);
  }

  hexToScreen(q, r) {
    const w = axialToWorld(q, r);
    return {
      x: (w.x - this.cam.x) * this.cam.zoom + this.width / 2,
      y: (w.y - this.cam.y) * this.cam.zoom + this.height / 2,
    };
  }

  // ---- camera ----------------------------------------------------------------------------------
  zoomAt(sx, sy, factor) {
    const before = this.screenToWorld(sx, sy);
    this.cam.zoom = Math.max(HEX_ZOOM_MIN, Math.min(HEX_ZOOM_MAX, this.cam.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.requestDraw();
  }

  zoomBy(factor) {
    this.zoomAt(this.width / 2, this.height / 2, factor);
  }

  centerOn(q, r, zoom) {
    const w = axialToWorld(q, r);
    this.cam.x = w.x;
    this.cam.y = w.y;
    if (zoom) this.cam.zoom = Math.max(HEX_ZOOM_MIN, Math.min(HEX_ZOOM_MAX, zoom));
    this.requestDraw();
  }

  // frame a list of "q,r" keys; with nothing to frame, go back to the origin
  fit(keys) {
    const list = Array.from(keys || []);
    if (!list.length) {
      this.cam = { x: 0, y: 0, zoom: 1 };
      this.requestDraw();
      return;
    }
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    list.forEach((key) => {
      const [q, r] = parseHexKey(key);
      const w = axialToWorld(q, r);
      x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x);
      y0 = Math.min(y0, w.y); y1 = Math.max(y1, w.y);
    });
    const pad = HEX_BASE * 3;
    const zoom = Math.min(this.width / (x1 - x0 + pad * 2), this.height / (y1 - y0 + pad * 2));
    this.cam.zoom = Math.max(HEX_ZOOM_MIN, Math.min(1.6, zoom));
    this.cam.x = (x0 + x1) / 2;
    this.cam.y = (y0 + y1) / 2;
    this.requestDraw();
  }

  // ---- drawing ----------------------------------------------------------------------------------
  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(this.width * dpr));
    this.canvas.height = Math.max(1, Math.round(this.height * dpr));
    this.requestDraw();
  }

  requestDraw() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => this.draw());
  }

  draw() {
    this._raf = null;
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    const z = this.cam.zoom;
    const s = HEX_BASE * z;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(0, 0, W, H);
    if (W < 2 || H < 2) return;

    // the range of hexes that could be on screen (a box in axial space)
    let qMin = Infinity;
    let qMax = -Infinity;
    let rMin = Infinity;
    let rMax = -Infinity;
    [[0, 0], [W, 0], [0, H], [W, H]].forEach(([sx, sy]) => {
      const w = this.screenToWorld(sx, sy);
      const q = ((HEX_SQRT3 / 3) * w.x - w.y / 3) / HEX_BASE;
      const r = ((2 / 3) * w.y) / HEX_BASE;
      qMin = Math.min(qMin, q); qMax = Math.max(qMax, q);
      rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
    });
    qMin = Math.floor(qMin) - 1; qMax = Math.ceil(qMax) + 1;
    rMin = Math.floor(rMin) - 1; rMax = Math.ceil(rMax) + 1;

    const showGrid = s >= 9; // too small to read? skip the grid lines altogether
    const grid = showGrid ? new Path2D() : null;
    const regionPaths = new Map();
    const selPath = new Path2D();
    let anySelected = false;
    const dots = [];
    const coords = [];
    const margin = s * 1.3;

    // everything that has to be drawn for one hex
    const visit = (q, r) => {
      const wx = HEX_BASE * HEX_SQRT3 * (q + r / 2);
      const wy = HEX_BASE * 1.5 * r;
      const cx = (wx - this.cam.x) * z + W / 2;
      const cy = (wy - this.cam.y) * z + H / 2;
      if (cx < -margin || cx > W + margin || cy < -margin || cy > H + margin) return;
      const key = `${q},${r}`;

      if (grid) hexPath(grid, cx, cy, s);

      const region = this.regionByKey.get(key);
      if (region) {
        let paths = regionPaths.get(region);
        if (!paths) {
          paths = { fill: new Path2D(), edge: new Path2D() };
          regionPaths.set(region, paths);
        }
        hexPath(paths.fill, cx, cy, s);
        for (let d = 0; d < 6; d++) {
          const neighbour = this.regionByKey.get(`${q + HEX_DIRS[d][0]},${r + HEX_DIRS[d][1]}`);
          if (neighbour !== region) {
            const e = HEX_EDGE[d];
            paths.edge.moveTo(cx + e[0][0] * s, cy + e[0][1] * s);
            paths.edge.lineTo(cx + e[1][0] * s, cy + e[1][1] * s);
          }
        }
      }

      if (this.selection.has(key)) {
        hexPath(selPath, cx, cy, s);
        anySelected = true;
      }
      const dot = this.dots.get(key);
      if (dot) dots.push({ cx, cy, dot });
      if (this.showCoords && s >= 26) coords.push({ cx, cy, q, r });
    };

    if (showGrid) {
      // close in: walk every hex on screen
      for (let r = rMin; r <= rMax; r++) {
        for (let q = qMin; q <= qMax; q++) visit(q, r);
      }
    } else {
      // zoomed far out: only walk the hexes that carry something, so the
      // cost depends on how much you've mapped, not on how much grid is in view
      const seen = new Set();
      const consider = (key) => {
        if (seen.has(key)) return;
        seen.add(key);
        const [q, r] = parseHexKey(key);
        visit(q, r);
      };
      this.regionByKey.forEach((_, key) => consider(key));
      this.selection.forEach(consider);
      this.dots.forEach((_, key) => consider(key));
    }

    if (grid) {
      ctx.strokeStyle = this.theme.grid;
      ctx.lineWidth = 1;
      ctx.stroke(grid);
    }

    regionPaths.forEach((paths, region) => {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = region.colorMain;
      ctx.fill(paths.fill);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = region.colorMain;
      ctx.lineWidth = Math.max(2, s * 0.09);
      ctx.lineCap = 'round';
      ctx.stroke(paths.edge);
    });

    if (anySelected) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = this.theme.select;
      ctx.fill(selPath);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = this.theme.select;
      ctx.lineWidth = 1.5;
      ctx.stroke(selPath);
    }

    const outline = (key, width, color) => {
      const [q, r] = parseHexKey(key);
      const c = this.hexToScreen(q, r);
      const p = new Path2D();
      hexPath(p, c.x, c.y, s, true);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke(p);
    };
    if (this.hover && (!this.selected || this.hover !== hexKey(this.selected[0], this.selected[1]))) {
      outline(this.hover, 1.5, 'rgba(239, 230, 216, 0.55)');
    }
    if (this.selected) outline(hexKey(this.selected[0], this.selected[1]), 2.5, this.theme.ink);

    if (coords.length) {
      ctx.fillStyle = 'rgba(168, 159, 144, 0.55)';
      ctx.font = `${Math.max(9, s * 0.26)}px Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      coords.forEach((c) => ctx.fillText(`${c.q},${c.r}`, c.cx, c.cy - s * 0.58));
    }

    const radius = Math.max(3.5, s * 0.34);
    dots.forEach(({ cx, cy, dot }) => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = dot.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.theme.bg;
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(239, 230, 216, 0.75)';
      ctx.stroke();
    });
    if (s >= 22) {
      ctx.font = `500 ${Math.max(11, s * 0.34)}px Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineJoin = 'round';
      dots.forEach(({ cx, cy, dot }) => {
        if (!dot.label) return;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeText(dot.label, cx, cy + radius + 3);
        ctx.fillStyle = this.theme.ink;
        ctx.fillText(dot.label, cx, cy + radius + 3);
      });
    }
  }

  // ---- input -------------------------------------------------------------------------------------
  _bind() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => this._down(e));
    c.addEventListener('pointermove', (e) => this._move(e));
    c.addEventListener('pointerup', (e) => this._up(e));
    c.addEventListener('pointercancel', (e) => this._up(e, true));
    c.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && this.hover) {
        this.hover = null;
        if (this.opts.onHover) this.opts.onHover(null);
        this.requestDraw();
      }
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(c);
    else window.addEventListener('resize', () => this.resize());
  }

  _pos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  _pinch() {
    const pts = Array.from(this.pointers.values());
    return {
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
    };
  }

  _paint(sx, sy) {
    const [q, r] = this.hexAt(sx, sy);
    const key = hexKey(q, r);
    if (key === this._lastPaint) return;
    this._lastPaint = key;
    if (this.opts.onPaint) this.opts.onPaint(q, r, this.press ? this.press.erase : this.paintErase);
  }

  _down(e) {
    const [x, y] = this._pos(e);
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x, y });
    if (this.pointers.size === 2) {
      this.gesture = this._pinch();
      this.press = null;
      return;
    }
    if (this.pointers.size > 2) return;
    const forcePan = e.button === 1 || e.button === 2;
    this.press = {
      id: e.pointerId,
      startX: x,
      startY: y,
      cam: { x: this.cam.x, y: this.cam.y },
      moved: false,
      button: e.button,
      mode: forcePan || this.dragMode === 'pan' ? 'pan' : 'paint',
      erase: e.shiftKey || this.paintErase,
    };
    if (this.press.mode === 'paint') {
      this._lastPaint = null;
      this._paint(x, y);
    }
  }

  _move(e) {
    const [x, y] = this._pos(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x, y });

    if (this.pointers.size === 2 && this.gesture) {
      const now = this._pinch();
      // zoom around the midpoint, and follow the midpoint as it moves
      this.zoomAt(now.x, now.y, now.dist / (this.gesture.dist || 1));
      this.cam.x -= (now.x - this.gesture.x) / this.cam.zoom;
      this.cam.y -= (now.y - this.gesture.y) / this.cam.zoom;
      this.gesture = now;
      this.requestDraw();
      return;
    }

    if (this.press && this.press.id === e.pointerId) {
      const p = this.press;
      if (!p.moved && Math.hypot(x - p.startX, y - p.startY) > 5) p.moved = true;
      if (p.mode === 'pan') {
        if (p.moved) {
          this.cam.x = p.cam.x - (x - p.startX) / this.cam.zoom;
          this.cam.y = p.cam.y - (y - p.startY) / this.cam.zoom;
          this.requestDraw();
        }
      } else {
        this._paint(x, y);
      }
      return;
    }

    if (e.pointerType === 'mouse') {
      const [q, r] = this.hexAt(x, y);
      const key = hexKey(q, r);
      if (key !== this.hover) {
        this.hover = key;
        if (this.opts.onHover) this.opts.onHover(q, r);
        this.requestDraw();
      }
    }
  }

  _up(e, cancelled) {
    const [x, y] = this._pos(e);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.gesture = null;
    const p = this.press;
    if (p && p.id === e.pointerId) {
      this.press = null;
      if (!cancelled && !p.moved && p.mode === 'pan' && p.button === 0 && this.opts.onHexClick) {
        const [q, r] = this.hexAt(x, y);
        this.opts.onHexClick(q, r, e);
      }
    }
  }
}
