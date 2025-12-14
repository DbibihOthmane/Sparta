// Mode éditeur pour placer les obstacles manuellement
let obstacleEditorMode = false;
let obstacleEditorUI = null;
let selectedObstacleShape = null;
let draggingObstacle = null;

class ObstacleEditor {
  constructor() {
    this.shapes = [
      { name: 'Small', w: 40, h: 40 },
      { name: 'Medium', w: 60, h: 60 },
      { name: 'Large', w: 80, h: 80 },
      { name: 'Wide', w: 100, h: 40 },
      { name: 'Tall', w: 40, h: 100 }
    ];
    this.isActive = false;
  }

  show() {
    if (!this.isActive) return;

    // Affiche les formes disponibles en haut à gauche
    push();
    fill(10, 10, 14, 200);
    stroke(255, 105, 210, 170);
    strokeWeight(2);
    rect(10, 10, 190, 240, 12);

    fill(255, 105, 210);
    textSize(14);
    textAlign(LEFT);
    text("OBSTACLE EDITOR", 20, 35);

    textSize(12);
    for (let i = 0; i < this.shapes.length; i++) {
      let shape = this.shapes[i];
      let y = 55 + i * 30;

      // Surbrille la forme sélectionnée
      if (selectedObstacleShape === i) {
        fill(255, 105, 210, 200);
        stroke(255, 180, 235, 230);
        strokeWeight(1);
      } else {
        noStroke();
        fill(255, 255, 255, 28);
      }

      rect(20, y, 170, 24, 10);

      noStroke();
      fill(235);
      textSize(11);
      text(
        `${shape.name} (${shape.w}x${shape.h})`,
        30,
        y + 16
      );
    }

    // Instructions (inside panel)
    fill(200);
    noStroke();
    textSize(11);
    text("Drag shape onto track", 20, 55 + this.shapes.length * 30 + 10);
    text("Right-click obstacle: remove", 20, 55 + this.shapes.length * 30 + 28);

    pop();
  }

  tryRemoveAt(x, y) {
    if (!Array.isArray(obstacles) || obstacles.length === 0) return false;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (!o) continue;
      const hw = (o.w || 0) * 0.5;
      const hh = (o.h || 0) * 0.5;
      if (Math.abs(x - o.x) <= hw && Math.abs(y - o.y) <= hh) {
        obstacles.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  selectShape(index) {
    selectedObstacleShape = index;
  }

  startDrag(x, y) {
    if (!this.isActive || selectedObstacleShape === null) return;

    const shape = this.shapes[selectedObstacleShape];
    draggingObstacle = new Obstacle(x, y, shape.w, shape.h);
  }

  drag(x, y) {
    if (draggingObstacle) {
      draggingObstacle.x = x;
      draggingObstacle.y = y;
    }
  }

  endDrag() {
    if (draggingObstacle) {
      // Vérifie que l'obstacle est dans les limites du canvas
      if (
        draggingObstacle.x > 50 &&
        draggingObstacle.x < width - 50 &&
        draggingObstacle.y > 50 &&
        draggingObstacle.y < height - 50
      ) {
        // Ajoute l'obstacle au tableau
        obstacles.push(draggingObstacle);
        console.log("Obstacle ajouté à:", draggingObstacle.x, draggingObstacle.y);
      } else {
        console.log("Obstacle hors limites - non ajouté");
      }
      draggingObstacle = null;
    }
  }

  toggle() {
    this.isActive = !this.isActive;
    if (this.isActive) {
      if (window.showModal) {
        window.showModal({
          title: "Obstacle editor",
          message: "Click a shape → drag on the track → drop.",
          kind: 'info',
          okText: 'OK'
        });
      } else if (window.showToast) {
        window.showToast("Obstacle editor enabled");
      }
    } else {
      if (window.showToast) {
        window.showToast("Obstacle editor disabled");
      }
      selectedObstacleShape = null;
    }
  }

  // Affiche un aperçu de l'obstacle en cours de déplacement
  showDraggingPreview() {
    if (draggingObstacle) {
      push();
      stroke(100, 255, 100);
      strokeWeight(3);
      fill(100, 255, 100, 50);
      rectMode(CENTER);
      rect(draggingObstacle.x, draggingObstacle.y, draggingObstacle.w, draggingObstacle.h);
      pop();
    }
  }
}

let obstacleEditor = new ObstacleEditor();