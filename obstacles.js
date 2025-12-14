// Obstacles statiques intégrés au circuit
class Obstacle {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;

    // Visualization-only: flash when hit by a car
    this.lastHitFrame = -1;
    this.hitCount = 0;
  }

  markHit() {
    this.hitCount++;
    this.lastHitFrame = (typeof frameCount !== 'undefined') ? frameCount : 0;
  }

  show() {
    push();
    rectMode(CENTER);

    // Base obstacle: neutral and readable (no effect by default)
    blendMode(BLEND);
    colorMode(RGB, 255);
    noStroke();
    fill(25, 25, 25, 230);
    rect(this.x, this.y, this.w, this.h, 4);

    // Tiny colored outline (subtler than the track) for a bit of life.
    const hueBase = (typeof VFX_HUE_BASE !== 'undefined') ? VFX_HUE_BASE : 285;
    noFill();
    colorMode(HSB, 360, 100, 100, 255);
    stroke(hueBase, 75, 100, 70);
    strokeWeight(1.8);
    rect(this.x, this.y, this.w, this.h, 4);

    // Very light neutral outline for readability
    colorMode(RGB, 255);
    stroke(255, 255, 255, 18);
    strokeWeight(1);
    rect(this.x, this.y, this.w, this.h, 4);

    // Flash when hit (checkpoint-like)
    if (this.lastHitFrame >= 0) {
      const fc = (typeof frameCount !== 'undefined') ? frameCount : 0;
      const age = fc - this.lastHitFrame;
      const ttlFrames = 10;
      if (age >= 0 && age <= ttlFrames) {
        const t = 1 - age / ttlFrames;
        const alpha = 255 * t;
        const hueBase = (typeof VFX_HUE_BASE !== 'undefined') ? VFX_HUE_BASE : 285;

        blendMode(ADD);
        colorMode(HSB, 360, 100, 100, 255);

        // Soft glow
        noFill();
        stroke(hueBase, 80, 100, alpha * 0.35);
        strokeWeight(14);
        rect(this.x, this.y, this.w + 4, this.h + 4, 6);

        // Bright core
        stroke(0, 0, 100, alpha * 0.8);
        strokeWeight(2.5);
        rect(this.x, this.y, this.w + 1, this.h + 1, 5);

        blendMode(BLEND);
        colorMode(RGB, 255);
      }
    }

    pop();
  }

  // Retourne les 4 arêtes du rectangle pour la détection de collision avec les rayons
  getEdges() {
    const left = this.x - this.w / 2;
    const right = this.x + this.w / 2;
    const top = this.y - this.h / 2;
    const bottom = this.y + this.h / 2;

    const edges = [
      new Boundary(left, top, right, top),       // haut
      new Boundary(right, top, right, bottom),   // droite
      new Boundary(right, bottom, left, bottom), // bas
      new Boundary(left, bottom, left, top)      // gauche
    ];

    // Tag edges so Vehicle.look() can attribute a collision to this obstacle.
    for (const e of edges) {
      e.isObstacleEdge = true;
      e.parentObstacle = this;
    }

    return edges;
  }
}

// Tableau global des obstacles
let obstacles = [];

function createStaticObstacle(x, y, w, h) {
  obstacles.push(new Obstacle(x, y, w, h));
}

function showObstacles() {
  for (let obs of obstacles) {
    obs.show();
  }
}

// Récupère tous les murs des obstacles (pour la détection par rayon)
function getObstacleWalls() {
  let walls = [];
  for (let obs of obstacles) {
    let edges = obs.getEdges();
    walls = walls.concat(edges);
  }
  return walls;
}

// Efface tous les obstacles
function clearObstacles() {
  obstacles = [];
}