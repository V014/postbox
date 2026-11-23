// Postbox Digital Signature Pad & Delivery Verification
(function () {
  class PostboxSignaturePad {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.isDrawing = false;
      this.hasSignature = false;

      this.setupCanvas();
      this.attachEvents();
    }

    setupCanvas() {
      // Fix high-DPI scaling
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = (rect.width || 320) * dpr;
      this.canvas.height = (rect.height || 140) * dpr;
      this.ctx.scale(dpr, dpr);

      this.ctx.lineWidth = 2.5;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = '#271816';
    }

    attachEvents() {
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: clientX - rect.left,
          y: clientY - rect.top
        };
      };

      const start = (e) => {
        e.preventDefault();
        this.isDrawing = true;
        const pos = getPos(e);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
      };

      const move = (e) => {
        if (!this.isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        this.hasSignature = true;
      };

      const stop = (e) => {
        if (!this.isDrawing) return;
        e.preventDefault();
        this.isDrawing = false;
      };

      // Mouse events
      this.canvas.addEventListener('mousedown', start);
      this.canvas.addEventListener('mousemove', move);
      window.addEventListener('mouseup', stop);

      // Touch events
      this.canvas.addEventListener('touchstart', start, { passive: false });
      this.canvas.addEventListener('touchmove', move, { passive: false });
      this.canvas.addEventListener('touchend', stop);
    }

    clear() {
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.clearRect(0, 0, rect.width, rect.height);
      this.hasSignature = false;
    }

    getDataURL() {
      if (!this.hasSignature) return null;
      return this.canvas.toDataURL('image/png');
    }
  }

  window.PostboxSignaturePad = PostboxSignaturePad;
})();
