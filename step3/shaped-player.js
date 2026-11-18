/*!
 * <shaped-player> : a video with no box around it.
 *
 *   <script src="shaped-player.js"></script>
 *   <shaped-player src="shaped.mp4" corner="bottom-right" width="320" movable controls></shaped-player>
 *
 * The clip is an ordinary H.264 file with two pictures stacked in every frame:
 * colour on top, a black and white outline of the figure underneath.
 *
 * Attributes
 *   src       the stacked clip (required)
 *   corner    bottom-right (default) | bottom-left | top-right | top-left | inline
 *   width     a number of pixels or any CSS length; default 320
 *   movable   visitors can drag the figure
 *   controls  shows a small sound button
 *   label     description for screen readers
 * Methods / properties:  play()  pause()  muted
 * Event:  "shapedready" once the first frame is drawn
 */
(function () {
  "use strict";
  if (!window.customElements || customElements.get("shaped-player")) return;

  var VS = "attribute vec2 p; varying vec2 uv; void main(){ uv = vec2((p.x+1.0)*0.5, (1.0-p.y)*0.5); gl_Position = vec4(p,0.0,1.0); }";
  var FS = "precision mediump float; varying vec2 uv; uniform sampler2D t; uniform float half_px;" +
           "void main(){ vec3 c = texture2D(t, vec2(uv.x, min(uv.y*0.5, 0.5-half_px))).rgb;" +
           "float a = smoothstep(0.10, 0.90, texture2D(t, vec2(uv.x, max(0.5+uv.y*0.5, 0.5+half_px))).r);" +
           "gl_FragColor = vec4(c*a, a); }";

  var CSS =
    ":host{display:block;position:fixed;z-index:2147483000;bottom:0;right:8px;width:var(--shaped-width,320px);max-width:92vw;pointer-events:none;line-height:0}" +
    ":host([corner='bottom-left']){left:8px;right:auto}" +
    ":host([corner='top-right']){top:8px;bottom:auto}" +
    ":host([corner='top-left']){top:8px;left:8px;right:auto;bottom:auto}" +
    ":host([corner='inline']){position:relative;z-index:auto;bottom:auto;right:auto}" +
    "canvas{display:block;width:100%;height:auto}" +
    "video{position:absolute;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none}" +
    "button{display:none;position:absolute;left:50%;bottom:10px;transform:translateX(-50%);pointer-events:auto;cursor:pointer;" +
      "font:500 12px/1 system-ui,-apple-system,'Segoe UI',sans-serif;color:#fff;background:rgba(11,11,15,.82);border:1px solid rgba(255,255,255,.22);" +
      "border-radius:999px;padding:8px 12px;white-space:nowrap;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}" +
    "button:focus-visible{outline:2px solid #fff;outline-offset:2px}" +
    ":host([controls]) button{display:inline-block}";

  function ShapedPlayer() {
    var self = Reflect.construct(HTMLElement, [], ShapedPlayer);
    var root = self.attachShadow({ mode: "open" });
    root.innerHTML = "<style>" + CSS + "</style><canvas part='figure'></canvas>" +
      "<video muted loop playsinline webkit-playsinline preload='auto'></video><button part='sound' type='button'>Sound off</button>";
    self._canvas = root.querySelector("canvas");
    self._video = root.querySelector("video");
    self._btn = root.querySelector("button");
    self._W = 0; self._H = 0; self._frames = 0; self._tx = 0; self._ty = 0; self._drag = null; self._raf = 0; self._hitData = null;
    self._hit = document.createElement("canvas"); self._hit.width = 48; self._hit.height = 40;
    self._hctx = self._hit.getContext("2d", { willReadFrequently: true });
    self._initDraw();
    self._btn.addEventListener("click", function () { self.muted = !self.muted; if (!self.muted) self.play(); });
    self._video.addEventListener("loadedmetadata", function () { self._W = 0; });
    self._video.addEventListener("error", function () { self.dispatchEvent(new CustomEvent("shapederror", { detail: "The clip could not be loaded: " + self.getAttribute("src") })); });
    self._bind();
    return self;
  }
  ShapedPlayer.prototype = Object.create(HTMLElement.prototype);
  ShapedPlayer.prototype.constructor = ShapedPlayer;
  Object.setPrototypeOf(ShapedPlayer, HTMLElement);
  ShapedPlayer.observedAttributes = ["src", "width", "label"];
  var P = ShapedPlayer.prototype;

  P._initDraw = function () {
    var gl = null, c = this._canvas;
    try { gl = c.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false }); } catch (e) { gl = null; }
    if (gl) {
      try {
        var sh = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader"); return s; };
        var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error("link");
        gl.useProgram(pr);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        this._gl = gl; this._uHalf = gl.getUniformLocation(pr, "half_px"); return;
      } catch (e) {
        var fresh = c.cloneNode(false); c.parentNode.replaceChild(fresh, c); this._canvas = fresh;
      }
    }
    this._gl = null; this._ctx = this._canvas.getContext("2d");
    this._scratch = document.createElement("canvas"); this._sctx = this._scratch.getContext("2d", { willReadFrequently: true });
  };

  P._draw = function () {
    var v = this._video, gl = this._gl;
    if (v.readyState < 2) return;
    if (!this._W) {
      this._W = v.videoWidth; this._H = Math.floor(v.videoHeight / 2);
      if (!this._W || !this._H) { this._W = 0; return; }
      this._canvas.width = this._W; this._canvas.height = this._H;
      if (gl) gl.viewport(0, 0, this._W, this._H); else { this._scratch.width = this._W; this._scratch.height = this._H * 2; }
      this._hit.height = Math.max(8, Math.round(48 * this._H / this._W));
    }
    var W = this._W, H = this._H;
    if (gl) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
      gl.uniform1f(this._uHalf, 0.75 / (2 * H)); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      this._sctx.drawImage(v, 0, 0, W, H * 2);
      var top = this._sctx.getImageData(0, 0, W, H), mat = this._sctx.getImageData(0, H, W, H).data, d = top.data;
      for (var i = 0; i < d.length; i += 4) d[i + 3] = mat[i];
      this._ctx.putImageData(top, 0, 0);
    }
    if (this._frames++ % 6 === 0) {
      try { this._hctx.drawImage(v, 0, H, W, H, 0, 0, this._hit.width, this._hit.height); this._hitData = this._hctx.getImageData(0, 0, this._hit.width, this._hit.height).data; } catch (e) { this._hitData = null; }
    }
    if (this._frames === 1) this.dispatchEvent(new CustomEvent("shapedready"));
  };

  /* true when the point is on the figure itself, not just inside its rectangle */
  P._onFigure = function (x, y) {
    var r = this._canvas.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
    if (!this._hitData) return true;
    var u = Math.min(this._hit.width - 1, Math.floor((x - r.left) / r.width * this._hit.width));
    var w = Math.min(this._hit.height - 1, Math.floor((y - r.top) / r.height * this._hit.height));
    return this._hitData[(w * this._hit.width + u) * 4] > 90;
  };

  P._bind = function () {
    var self = this;
    function movable() { return self.hasAttribute("movable"); }
    function start(x, y) { self._drag = { x: x, y: y, tx: self._tx, ty: self._ty }; }
    function move(x, y) {
      var d = self._drag; if (!d) return;
      var r = self.getBoundingClientRect(), nx = d.tx + (x - d.x), ny = d.ty + (y - d.y);
      if (self.getAttribute("corner") !== "inline") {            /* keep at least a third of the figure on screen */
        var left = r.left - self._tx + nx, top = r.top - self._ty + ny;
        nx += Math.max(0, -r.width * 0.66 - left) - Math.max(0, left - (window.innerWidth - r.width * 0.34));
        ny += Math.max(0, -r.height * 0.5 - top) - Math.max(0, top - (window.innerHeight - r.height * 0.4));
      }
      self._tx = nx; self._ty = ny; self.style.transform = "translate(" + nx + "px," + ny + "px)";
    }
    function end() { if (self._drag) { self._drag = null; document.documentElement.style.cursor = ""; } }
    this._on = {
      mousedown: function (e) { if (movable() && e.button === 0 && self._onFigure(e.clientX, e.clientY) && e.composedPath()[0] !== self._btn) { start(e.clientX, e.clientY); e.preventDefault(); } },
      mousemove: function (e) {
        if (self._drag) { move(e.clientX, e.clientY); document.documentElement.style.cursor = "grabbing"; }
        else if (movable()) { var over = self._onFigure(e.clientX, e.clientY); if (over !== self._over) { self._over = over; document.documentElement.style.cursor = over ? "grab" : ""; } }
      },
      mouseup: end,
      touchstart: function (e) { var t = e.touches[0]; if (movable() && e.touches.length === 1 && self._onFigure(t.clientX, t.clientY) && e.composedPath()[0] !== self._btn) { start(t.clientX, t.clientY); e.preventDefault(); } },
      touchmove: function (e) { if (self._drag) { var t = e.touches[0]; move(t.clientX, t.clientY); e.preventDefault(); } },
      touchend: end, touchcancel: end
    };
  };

  P.connectedCallback = function () {
    var self = this, on = this._on;
    if (!this.hasAttribute("role")) this.setAttribute("role", "img");
    if (!this.hasAttribute("aria-label")) this.setAttribute("aria-label", this.getAttribute("label") || "Video");
    document.addEventListener("mousedown", on.mousedown); document.addEventListener("mousemove", on.mousemove); document.addEventListener("mouseup", on.mouseup);
    document.addEventListener("touchstart", on.touchstart, { passive: false }); document.addEventListener("touchmove", on.touchmove, { passive: false });
    document.addEventListener("touchend", on.touchend); document.addEventListener("touchcancel", on.touchcancel);
    (function loop() { self._raf = requestAnimationFrame(loop); self._draw(); })();
    this.play();
  };
  P.disconnectedCallback = function () {
    var on = this._on; cancelAnimationFrame(this._raf); this._video.pause();
    ["mousedown", "mousemove", "mouseup", "touchstart", "touchmove", "touchend", "touchcancel"].forEach(function (k) { document.removeEventListener(k, on[k]); });
  };
  P.attributeChangedCallback = function (name, old, val) {
    if (name === "src" && val !== old) { this._frames = 0; this._W = 0; this._video.src = val || ""; if (this.isConnected) this.play(); }
    if (name === "width") { if (val) this.style.setProperty("--shaped-width", /^\d+(\.\d+)?$/.test(val) ? val + "px" : val); else this.style.removeProperty("--shaped-width"); }
    if (name === "label") this.setAttribute("aria-label", val || "Video");
  };
  P.play = function () {
    var self = this, p = this._video.play();
    if (p && p.catch) p.catch(function () {                      /* autoplay refused: start on the visitor's first touch */
      var once = function () { document.removeEventListener("pointerdown", once); self._video.play().catch(function () {}); };
      document.addEventListener("pointerdown", once);
    });
    return p;
  };
  P.pause = function () { this._video.pause(); };
  Object.defineProperty(P, "muted", {
    get: function () { return this._video.muted; },
    set: function (m) { this._video.muted = !!m; this._btn.textContent = m ? "Sound off" : "Sound on"; this._btn.setAttribute("aria-pressed", String(!m)); }
  });
  Object.defineProperty(P, "paused", { get: function () { return this._video.paused; } });

  customElements.define("shaped-player", ShapedPlayer);
})();
