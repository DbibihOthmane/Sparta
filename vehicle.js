function pldistance(p1, p2, x, y) {
    const num = abs((p2.y - p1.y) * x - (p2.x - p1.x) * y + p2.x * p1.y - p2.y * p1.x);
    const den = p5.Vector.dist(p1, p2);
    return num / den;
  }
  
  class Vehicle {
    constructor(brain) {
      // nombre de checkpoints passés
      this.fitness = 0;
      // Pure counter used for race ranking (not modified by calculateFitness)
      this.checkpointsPassed = 0;

      // Visualization-only / ranking-only: cumulative distance traveled
      // (Used in RACE ranking so the displayed distance doesn't reset)
      this.distanceTravelled = 0;
      this.dead = false;
      this.finished = false;
      this.pos = createVector(start.x, start.y);
      this.vel = createVector();
      this.acc = createVector();
      this.maxspeed = (typeof MAXSPEED !== 'undefined') ? MAXSPEED : 5;
      this.maxforce = (typeof MAXFORCE !== 'undefined') ? MAXFORCE : 0.2;
      this.sight = (typeof SIGHT !== 'undefined') ? SIGHT : 50;
      // les rayons des capteurs
      this.rays = [];
      this.index = 0;
      this.counter = 0;

      // If true, the car won't die just because it exceeded LIFESPAN.
      // (Used for RACE mode so cars only die on crash.)
      this.ignoreLifespan = false;

      // Visualization-only (race mode): optional custom render color + label
      this.renderColor = null;
      this.displayName = null;

      // Mode hint used to ignore TRAINING-only tuning in RACE.
      this.isRace = false;
  
      // On créer des rayons tous les 15°, entre -45° et 45°
      // on a un angle de vision de 90°
      for (let a = -45; a <= 45; a += 15) {
        this.rays.push(new Ray(this.pos, radians(a)));
      }

      let length = this.rays.length;

      // On crée le "cerveau" de la voiture
      // C'est un réseau de neurones
      // qui va prendre des décisions en fonction
      // de ce que la voiture voit
      if (brain) {
        this.brain = brain.copy();
      } else {
        // On créer un réseau de neurones, le nombre de neurones
        // en entrée est égal au nombre de rayons
        // le nombre de neurones en sortie est égal à 2
        // car on a 2 sorties, la direction et la vitesse
        // On a donc 2 couches cachées
        // Le nombre de neurones dans le layer caché est égal
        // au nombre de neurones en entrée * 2
        // On a donc 2 layers de length neurones
        // si length vaut 9 par exemple, on a 9 neurones en entrée
        // On a donc 18 neurones en tout
        // On a donc 18 * 18 + 18 = 342 poids
        // On a donc 342 + 18 = 360 biais
        // On a donc 360 + 342 = 702 paramètres
        this.brain = new NeuralNetwork(this.rays.length, this.rays.length * 2, 2);
      }
    }

    // Reset vehicle state to start position (race mode respawn)
    resetToStart() {
      // IMPORTANT: do not replace this.pos object; rays keep a reference to it.
      if (typeof start !== 'undefined' && start) {
        this.pos.set(start.x, start.y);
      }
      this.vel.set(0, 0);
      this.acc.set(0, 0);
      this.dead = false;
      this.finished = false;
      this.index = 0;
      this.counter = 0;
      this.fitness = 0;
      this.checkpointsPassed = 0;
      this.distanceTravelled = 0;
      this.goal = null;

      // Ensure rays point to the current pos vector
      for (let i = 0; i < this.rays.length; i++) {
        this.rays[i].pos = this.pos;
      }
    }
  
    dispose() {
      this.brain.dispose();
    }
  
 applyBehaviors(walls) {
  // Combine les murs du circuit et des obstacles
  let allWalls = walls.concat(getObstacleWalls());
  // On appelle le comportement look
  let force = this.look(allWalls);
  this.applyForce(force);
}

    mutate() {
  // Ne pas muter les cerveaux chargés - ils gardent leur performance
  if (this.brain.isLoaded) {
    console.log("Cerveau chargé: pas de mutation");
    return;
  }
  this.brain.mutate(MUTATION_RATE);
}
  
    applyForce(force) {
      this.acc.add(force);
    }
  
    update() {
      if (!this.dead && !this.finished) {
        // If a car somehow crosses the boundary (high speed can tunnel),
        // mark it as crashed as soon as it leaves the track.
        // isOnTrack() is defined in sketch.js.
        const prevPos = this.pos.copy();
        this.pos.add(this.vel);

        if (typeof isOnTrack === 'function' && !isOnTrack(this.pos.x, this.pos.y)) {
          this.dead = true;
          // Freeze at the edge (optional): keep last valid position for nicer visuals
          this.pos.set(prevPos.x, prevPos.y);
          return;
        }

        // Accumulate distance only when the move is valid.
        this.distanceTravelled += p5.Vector.dist(prevPos, this.pos);

        this.vel.add(this.acc);
        this.vel.limit(this.maxspeed);
        this.acc.set(0, 0);

        // On incrémente le compteur
        // si on dépasse le temps de vie
        // on meurt, on tue la voiture
        this.counter++;
        if (!this.ignoreLifespan && this.counter > LIFESPAN) {
          this.dead = true;
        }
  
        // on a fait déplacer et tourner la voiture, on va
        // aussi faire tourner les rayons
        for (let i = 0; i < this.rays.length; i++) {
          this.rays[i].rotate(this.vel.heading());
        }
      }
    }
  
    // On vérifie si on a atteint le checkpoint, ou si on a atteint
    // la fin du circuit
    check(checkpoints) {
      if (!this.finished) {
        // On a pas fait un tout complet, on regarde quel est le checkpoint à atteindre
        // rappel : un checkpoint est une ligne avec deux points a et b
        // et la voiture doit le "franchir"
        this.goal = checkpoints[this.index];

        // Est-ce qu'on a atteint le checkpoint ?
        // La fonction pldistance calcule la distance
        // entre un point et une ligne définie par deux points
        // c'est fourni par p5.js
        const d = pldistance(this.goal.a, this.goal.b, this.pos.x, this.pos.y);
      
        if (d < 5) {
          const crossed = this.goal;
          // Si on l'a atteint, on passe au checkpoint suivant
          this.index = (this.index + 1) % checkpoints.length;
          // et on augmente la fitness, c'est le nombre de checkpoint parcourus
          this.fitness++;
          this.checkpointsPassed++;
          this.counter = 0;
          return crossed;
        }
      }

      return null;
    }
  
    // Ajustage de la fonction de fitness
   /* calculateFitness() {
      // on met la fitness au carré, pour voir si ça marche mieux
      this.fitness = pow(2, this.fitness);

      // On pourrait booster la fitness si on a fini le circuit....
      // if (this.finished) {
      // } else {
      //   const d = p5.Vector.dist(this.pos, target);
      //   this.fitness = constrain(1 / d, 0, 1);
      // }
    }*/
  
      calculateFitness() {
  if (this.fitness === 0) {
    this.fitness = 0.01;
    return;
  }
  const progressScore = pow(2, this.fitness);
  const timePenalty = 1 + this.counter / 300; // stuck = die in selection
  this.fitness = progressScore / timePenalty;

  if (this.finished) this.fitness *= 8;
}
    // C'est LE comportement de la voiture,
    // elle va regarder autour d'elle et prendre des décisions
    // en fonction de ce qu'elle voit
    // Elle va ensuite appliquer une force pour se diriger
    // vers le checkpoint suivant
    // Elle va aussi éviter les murs
    look(walls) {

      if (this.dead || this.finished) return createVector(0, 0);

      // Lancement des rayons
      // On va regarder autour de nous
      // pour voir si on a des murs
      // On va ensuite prendre des décisions
      // en fonction de ce qu'on voit
      const inputs = new Array(this.rays.length).fill(0);

      // Pour chaque rayon
      for (let i = 0; i < this.rays.length; i++) {
        const ray = this.rays[i];
        let closest = null;
        let record = this.sight;
        let closestWall = null;

        // Pour chaque mur
        for (let wall of walls) {
          // On regarde si le rayon intersecte le mur en question
          const pt = ray.cast(wall);
          if (pt) {
            const d = p5.Vector.dist(this.pos, pt);
            if (d < record && d < this.sight) {
              record = d;
              closest = pt;
              closestWall = wall;
            }
          }
        }
  
        // Si on est à moins de 5 pixels d'un mur, on meurt
        if (record < 5) {
          if (!this.dead && closestWall && closestWall.parentObstacle && typeof closestWall.parentObstacle.markHit === 'function') {
            // Visual-only: flash the obstacle that was hit.
            closestWall.parentObstacle.markHit();
          }
          this.dead = true;
          break;
        }
  
        // On met la couche de neurone en entrée avec des valeurs entre 0 et 1
        // Rappel, on a i rayons (on est dans une boucle for sur les rayons
        // et on a une couche d'entrée avec autant de neuronnes que de rayons
        inputs[i] = map(record, 0, 50, 1, 0);
  
        // Si on a touché au moins un mur
        if (closest) {
          // colorMode(HSB);
          // stroke((i + frameCount * 2) % 360, 255, 255, 50);
          // stroke(255);
          // line(this.pos.x, this.pos.y, closest.x, closest.y);
        }
      }

      // If we died during sensing, don't ask the network to predict.
      // (Avoids passing a partially-filled input vector to TF.)
      if (this.dead) return createVector(0, 0);

      // On demande au réseau de neurones de prédire la prochaine action
      // output est un tableau à deux dimensions, deux neurones en sortie
      // output[0] est la direction
      // output[1] est la vitesse
      
      const output = this.brain.predict(inputs);
      
      let angle = map(output[0], 0, 1, -PI, PI);
      //let speed = map(output[1], 0, 1, 0, this.maxspeed);
      let speed = this.maxspeed * (0.85 + 0.15 * output[1]); // Speed between 85% and 100%
      angle += this.vel.heading();

      // Calcul de la force à appliquer
      // On calcule un vecteur à partir de l'angle et de la vitesse
      // c'est la vitesse souhaitée
      const vitesseSouhaitee = p5.Vector.fromAngle(angle);
      vitesseSouhaitee.setMag(speed);

      // force = vitesse souhaitée - vitesse actuelle
      let force = p5.Vector.sub(vitesseSouhaitee, this.vel);
    
      // On limite la force
      force.limit(this.maxforce);
      // On applique la force
      return force;
    }


    checkObstacles() {
  // Vérifie la collision simple (rayon de 5px)
  for (let obs of obstacles) {
    if (obs.collidesWith(this.pos, 5)) {
      this.dead = true;
      return;
    }
  }
}
  
    // Dessin de la voiture
    show() {
      push();
      translate(this.pos.x, this.pos.y);
      const heading = this.vel.heading();
      rotate(heading);
      colorMode(RGB, 255);
      rectMode(CENTER);

      // Small body (default): solid or gradient if provided
      if (this.renderColorA && this.renderColorB) {
        const steps = 6;
        const w = 10;
        const h = 5;
        noStroke();
        for (let i = 0; i < steps; i++) {
          const t = steps === 1 ? 0 : i / (steps - 1);
          const c = lerpColor(this.renderColorA, this.renderColorB, t);
          fill(red(c), green(c), blue(c), 170);
          const x = -w / 2 + (i + 0.5) * (w / steps);
          rect(x, 0, w / steps + 0.5, h);
        }
      } else if (this.renderColor) {
        // renderColor is a p5 color
        fill(red(this.renderColor), green(this.renderColor), blue(this.renderColor), 170);
        rect(0, 0, 10, 5);
      } else {
        fill(255, 100);
        rect(0, 0, 10, 5);
      }
      pop();
    }
  
    // Met en surbrillance la voiture
    highlight(showRays = true) {
      push();
      translate(this.pos.x, this.pos.y);
      const heading = this.vel.heading();
      rotate(heading);
      colorMode(RGB, 255);
      rectMode(CENTER);

      // Larger body: gradient fill (race) or solid (training)
      if (this.renderColorA && this.renderColorB) {
        const steps = 8;
        const w = 20;
        const h = 10;
        // Outline
        const edge = this.renderColorA;
        stroke(red(edge), green(edge), blue(edge), 255);
        strokeWeight(1.5);
        noFill();
        rect(0, 0, w, h);

        noStroke();
        for (let i = 0; i < steps; i++) {
          const t = steps === 1 ? 0 : i / (steps - 1);
          const c = lerpColor(this.renderColorA, this.renderColorB, t);
          fill(red(c), green(c), blue(c), 150);
          const x = -w / 2 + (i + 0.5) * (w / steps);
          rect(x, 0, w / steps + 0.7, h - 1.5);
        }
      } else if (this.renderColor) {
        stroke(red(this.renderColor), green(this.renderColor), blue(this.renderColor), 255);
        fill(red(this.renderColor), green(this.renderColor), blue(this.renderColor), 140);
        rect(0, 0, 20, 10);
      } else {
        stroke(0, 255, 0);
        fill(0, 255, 0);
        rect(0, 0, 20, 10);
      }
      pop();

      if (showRays) {
        // On dessine aussi les rayons de la voiture en tête
        for (let ray of this.rays) {
          ray.show(this.renderColor, this.sight);
        }
      }
    }

    // Large body (same size as highlight) but without rays.
    // Useful in RACE mode when a car is crashed and frozen.
    showLarge() {
      push();
      translate(this.pos.x, this.pos.y);
      const heading = this.vel.heading();
      rotate(heading);
      colorMode(RGB, 255);
      rectMode(CENTER);

      if (this.renderColorA && this.renderColorB) {
        const steps = 8;
        const w = 20;
        const h = 10;
        const edge = this.renderColorA;
        stroke(red(edge), green(edge), blue(edge), 255);
        strokeWeight(1.5);
        noFill();
        rect(0, 0, w, h);
        noStroke();
        for (let i = 0; i < steps; i++) {
          const t = steps === 1 ? 0 : i / (steps - 1);
          const c = lerpColor(this.renderColorA, this.renderColorB, t);
          fill(red(c), green(c), blue(c), 150);
          const x = -w / 2 + (i + 0.5) * (w / steps);
          rect(x, 0, w / steps + 0.7, h - 1.5);
        }
      } else if (this.renderColor) {
        stroke(red(this.renderColor), green(this.renderColor), blue(this.renderColor), 255);
        fill(red(this.renderColor), green(this.renderColor), blue(this.renderColor), 140);
        rect(0, 0, 20, 10);
      } else {
        stroke(0, 255, 0);
        fill(0, 255, 0);
        rect(0, 0, 20, 10);
      }
      pop();
    }
  }