
class Boundary {
    constructor(x1, y1, x2, y2) {
      this.a = createVector(x1, y1);
      this.b = createVector(x2, y2);

      // Optional metadata (used when this Boundary represents a checkpoint)
      this.isCheckpoint = false;
      this.lastHitFrame = -1;
      this.hitCount = 0;
    }
  
    midpoint() {
      return createVector((this.a.x + this.b.x) * 0.5, (this.a.y + this.b.y) * 0.5);
    }
  
    show() {
      stroke(255);
      line(this.a.x, this.a.y, this.b.x, this.b.y);
    }

    markHit() {
      this.hitCount++;
      // frameCount is provided by p5
      this.lastHitFrame = (typeof frameCount !== 'undefined') ? frameCount : 0;
    }

    // Draws the checkpoint only if it was hit recently.
    // ttlFrames is in rendered frames (not simulation cycles).
    // Simple neon flash + fade (easy to read).
    showCheckpoint(ttlFrames = 10) {
      if (this.lastHitFrame < 0) return;
      const fc = (typeof frameCount !== 'undefined') ? frameCount : 0;
      const age = fc - this.lastHitFrame;
      if (age > ttlFrames) return;

      const t = 1 - age / ttlFrames;
      const alpha = 255 * t;

      push();
      blendMode(ADD);
      strokeCap(ROUND);

      // Soft glow
      stroke(255, 90, 230, alpha * 0.35);
      strokeWeight(10);
      line(this.a.x, this.a.y, this.b.x, this.b.y);

      // Bright core
      stroke(255, 255, 255, alpha * 0.75);
      strokeWeight(2.5);
      line(this.a.x, this.a.y, this.b.x, this.b.y);

      blendMode(BLEND);
      pop();
    }
  }