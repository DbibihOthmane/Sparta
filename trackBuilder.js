// Track Builder - Interface simple pour créer et modifier les pistes

class TrackBuilder {
  constructor() {
    this.isActive = false;
    this.isEditing = false;
    this.points = [];
    this.pathWidth = 60;
    this.isDragging = false;
    this.draggedPointIndex = -1;

    // Width adjustment by drag (when clicking empty space)
    this.isWidthDragging = false;
    this.widthDragStartY = 0;
    this.widthStart = 0;
  }

  toggle() {
    this.isActive = !this.isActive;
    this.isEditing = false;
    if (this.isActive) {
      this.points = [];
      const msg =
        "1) Click to add points (minimum 4)\n" +
        "2) Right-click to undo last point\n" +
        "3) Drag on empty space to adjust track width\n" +
        "4) Press ENTER to finalize\n" +
        "5) After: Drag points to adjust\n\n" +
        "Track is validated automatically.";

      if (window.showModal) {
        window.showModal({
          title: 'Track builder',
          message: msg,
          kind: 'info',
          okText: 'Start'
        });
      } else if (window.showToast) {
        window.showToast('Track builder enabled');
      }
    }
  }

  addPoint(x, y) {
    if (!this.isActive || this.isEditing) return;
    
    // Ajoute le point
    this.points.push(createVector(x, y));
    
    // Valide en temps réel
    if (this.points.length >= 4) {
      if (this.isOverlapping()) {
        this.points.pop();
        console.warn("❌ Track overlapping detected - point rejected");
      }
    }
  }

  undoPoint() {
    if (!this.isActive || this.isEditing) return;
    if (this.points.length > 0) {
      this.points.pop();
    }
  }

  // Vérifie si la piste se chevauche
  isOverlapping() {
    if (this.points.length < 4) return false;

    for (let i = 0; i < this.points.length - 1; i++) {
      for (let j = i + 2; j < this.points.length; j++) {
        // Évite de vérifier les segments adjacents
        if (j === i + 1 || (i === 0 && j === this.points.length - 1)) continue;

        if (this.linesIntersect(
          this.points[i], this.points[i + 1],
          this.points[j], this.points[(j + 1) % this.points.length]
        )) {
          return true;
        }
      }
    }
    return false;
  }

  // Détecte l'intersection entre deux segments
  linesIntersect(p1, p2, p3, p4) {
    const ccw = (A, B, C) => {
      return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    };
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  }

  show() {
    if (!this.isActive) return;

    push();

    // Grille de fond
    this.drawGrid();

    // Dessine la piste
    if (this.points.length > 0) {
      this.drawTrackPreview();
    }

    // Affiche l'interface
    this.showUI();

    pop();
  }

  drawGrid() {
    stroke(50);
    strokeWeight(1);
    for (let x = 0; x < width; x += 50) {
      line(x, 0, x, height);
    }
    for (let y = 0; y < height; y += 50) {
      line(0, y, width, y);
    }
  }

  drawTrackPreview() {
    // Dessine les segments
    stroke(100, 200, 100);
    strokeWeight(3);
    for (let i = 0; i < this.points.length; i++) {
      let p1 = this.points[i];
      let p2 = this.points[(i + 1) % this.points.length];
      line(p1.x, p1.y, p2.x, p2.y);
    }

    // Dessine les points
    for (let i = 0; i < this.points.length; i++) {
      let p = this.points[i];
      let isHovered = dist(mouseX, mouseY, p.x, p.y) < 15;

      fill(isHovered ? 255 : 100, 255, 100);
      noStroke();
      circle(p.x, p.y, isHovered ? 16 : 12);

      // Numéro du point
      fill(0);
      textSize(10);
      textAlign(CENTER, CENTER);
      text(i, p.x, p.y);
    }

    // Aperçu des murs (intérieur/extérieur)
    if (this.points.length > 2) {
      stroke(200, 100, 100, 80);
      strokeWeight(1);
      
      for (let i = 0; i < this.points.length; i++) {
        let p1 = this.points[i];
        let p2 = this.points[(i + 1) % this.points.length];
        
        let dir = p5.Vector.sub(p2, p1);
        dir.normalize();
        let perp = createVector(-dir.y, dir.x);
        
        let inner1 = p5.Vector.add(p1, p5.Vector.mult(perp, this.pathWidth));
        let inner2 = p5.Vector.add(p2, p5.Vector.mult(perp, this.pathWidth));
        let outer1 = p5.Vector.sub(p1, p5.Vector.mult(perp, this.pathWidth));
        let outer2 = p5.Vector.sub(p2, p5.Vector.mult(perp, this.pathWidth));
        
        line(inner1.x, inner1.y, inner2.x, inner2.y);
        line(outer1.x, outer1.y, outer2.x, outer2.y);
      }
    }
  }

  showUI() {
    push();
    // Panel de contrôle
    fill(10, 10, 14, 200);
    stroke(255, 105, 210, 170);
    strokeWeight(2);
    rect(10, 10, 300, 200, 12);

    fill(255, 105, 210);
    textSize(16);
    textAlign(LEFT);
    textStyle(BOLD);
    text("TRACK BUILDER", 20, 35);

    fill(200);
    textSize(12);
    textStyle(NORMAL);
    
    let status = this.points.length < 4 ? "Need 4+ points" : "Valid track";
    text(status, 20, 60);
    text(`Points: ${this.points.length}`, 20, 80);
    text(`Width: ${this.pathWidth}px`, 20, 100);

    fill(150);
    text("━━━━━━━━━━━━━━━━━", 20, 120);

    fill(200);
    text("LEFT CLICK: Add point", 20, 140);
    text("RIGHT CLICK: Undo", 20, 160);
    text("DRAG EMPTY: Width ±", 20, 180);
    text("ENTER: Finalize", 20, 200);

    pop();
  }

  getPointAtMouse(x, y, radius = 15) {
    for (let i = 0; i < this.points.length; i++) {
      if (dist(x, y, this.points[i].x, this.points[i].y) < radius) {
        return i;
      }
    }
    return -1;
  }

  startDrag(x, y) {
    let index = this.getPointAtMouse(x, y);
    if (index !== -1) {
      this.isDragging = true;
      this.draggedPointIndex = index;
      this.isWidthDragging = false;
      return;
    }

    // Clicked empty space: adjust width by vertical drag
    this.isDragging = false;
    this.draggedPointIndex = -1;
    this.isWidthDragging = true;
    this.widthDragStartY = y;
    this.widthStart = this.pathWidth;
  }

  drag(x, y) {
    if (this.isDragging && this.draggedPointIndex !== -1) {
      this.points[this.draggedPointIndex].x = x;
      this.points[this.draggedPointIndex].y = y;
      return;
    }

    if (this.isWidthDragging) {
      const dy = this.widthDragStartY - y; // drag up => wider
      const next = this.widthStart + dy * 0.25;
      this.pathWidth = constrain(next, 30, 120);
    }
  }

  endDrag() {
    this.isDragging = false;
    this.draggedPointIndex = -1;

    this.isWidthDragging = false;
  }

  adjustWidth(delta) {
    this.pathWidth = constrain(this.pathWidth + delta, 30, 120);
  }

  canFinalize() {
    return this.points.length >= 4 && !this.isOverlapping();
  }

 /* finalizeTrack(buildTrackFunction) {
    if (!this.canFinalize()) {
      if (window.showToast) window.showToast("Need 4+ points with NO overlaps");
      return false;
    }

    // Lisse la piste avec interpolation catmull-rom
    let smoothPoints = [];
    for (let i = 0; i < this.points.length; i++) {
      for (let t = 0; t < 1; t += 0.1) {
        let p0 = this.points[(i - 1 + this.points.length) % this.points.length];
        let p1 = this.points[i];
        let p2 = this.points[(i + 1) % this.points.length];
        let p3 = this.points[(i + 2) % this.points.length];

        // Catmull-Rom interpolation
        let t2 = t * t;
        let t3 = t2 * t;
        let q = 0.5 * (
          2 * p1 +
          (-p0 + p2) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
          (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );

        let interpPoint = createVector(q, q); // Fix: proper interpolation
        
        // Manual interpolation for cleaner code
        let x = 0.5 * (
          2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        let y = 0.5 * (
          2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );

        smoothPoints.push(createVector(x, y));
      }
    }

    buildTrackFunction(smoothPoints, this.pathWidth);
    this.isActive = false;
    this.isEditing = false;
    return true;
  }
  */

  finalizeTrack(buildTrackFunction) {
  if (!this.canFinalize()) {
    if (window.showToast) {
      window.showToast("Need 4+ points with NO overlaps");
    }
    return false;
  }

  buildTrackFunction(this.points, this.pathWidth);
  this.isActive = false;
  this.isEditing = false;
  return true;
}
  
  // Permet de continuer à éditer après finalisation
  enableEditing() {
    this.isEditing = true;
    this.isActive = true;
  }

  showEditing() {
    if (!this.isEditing || this.points.length === 0) return;

    push();

    this.drawTrackPreview();

    // Panel simple
    fill(30);
    stroke(100, 255, 100);
    strokeWeight(3);
    rect(10, 10, 280, 100);

    fill(100, 255, 100);
    textSize(14);
    textAlign(LEFT);
    text("ADJUST TRACK", 20, 35);

    fill(200);
    textSize(12);
    text("DRAG points to adjust", 20, 60);
    text("DRAG EMPTY: Width ±", 20, 80);
    text("PRESS 'E' to add obstacles", 20, 100);

    pop();
  }
}

let trackBuilder = new TrackBuilder();

