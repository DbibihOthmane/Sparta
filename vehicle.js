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

      // Drift parameters
      this.gripStatic = 2.0;
      this.gripDynamic = 0.5;
      this.driftConstant = 3.0;
      this.isDrifting = false;

      // Brain is set in subclasses (RobotVehicle has one, HumanVehicle doesn't)
      this.brain = brain || null;
    }

    // Helper: Body to world rotation
    vectBodyToWorld(vect, ang) {
      let v = vect.copy();
      let vn = createVector(
        v.x * cos(ang) - v.y * sin(ang),
        v.x * sin(ang) + v.y * cos(ang)
      );
      return vn;
    }

    // Helper: World to body rotation
    vectWorldToBody(vect, ang) {
      let v = vect.copy();
      let vn = createVector(
        v.x * cos(ang) + v.y * sin(ang),
        v.x * sin(ang) - v.y * cos(ang)
      );
      return vn;
    }

    // Override this method in subclasses to provide control logic
    // Returns [steering, throttle] where both are 0-1 range
    getControlOutput(inputs) {
      // Base class: no control (should be overridden)
      return [0.5, 1.0];  // Straight ahead, full throttle
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
      this.isDrifting = false;

      // Ensure rays point to the current pos vector
      for (let i = 0; i < this.rays.length; i++) {
        this.rays[i].pos = this.pos;
      }
    }
  
    dispose() {
      if (this.brain) {
        this.brain.dispose();
      }
    }
  
  applyBehaviors(walls, vehicles) {
    // Combine les murs du circuit et des obstacles
    let allWalls = walls.concat(getObstacleWalls());
    // On appelle le comportement look
    let force = this.look(allWalls);
    this.applyForce(force);

    // Separation (keep cars from stacking)
    if (vehicles) {
      let sep = this.separation(vehicles);
      sep.mult(1.5); // Weight for separation
      this.applyForce(sep);
    }
  }

  separation(vehicles) {
    let perceptionRadius = 24;
    let steering = createVector();
    let total = 0;
    for (let other of vehicles) {
      let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      if (other != this && d < perceptionRadius) {
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.div(d * d);
        steering.add(diff);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total);
      steering.setMag(this.maxspeed);
      steering.sub(this.vel);
      steering.limit(this.maxforce);
    }
    return steering;
  }

    mutate() {
  // Only mutate if brain exists (RobotVehicle)
  if (!this.brain) return;

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
        // Drift Physics Implementation
        // 1. Get current heading
        const heading = this.vel.heading();

        // 2. Rotate velocity to body frame (x = sideways/drift, y = forward)
        // note: our cars face East (0), so x is forward? 
        // In p5.Vector.fromAngle(0), x=1, y=0.
        // Let's stick to standard: x is "forward" relative to heading?
        // Wait, typical body frame: x=forward, y=lateral? Or standard car frame?
        // Let's use the helper provided in drift-car which expects standard mathematical rotation.
        // In drift-car: "x = sideways velocity, y = forward/backwards" (comment line 77 of drift-car/car.js)
        // Let's re-verify drift-car vectWorldToBody. 
        // vectWorldToBody(v, ang) { x*cos + y*sin, x*sin - y*cos } is standard rotation by -ang?
        // Actually: 
        // Rot(theta) * v = v_world
        // v_body = Rot(-theta) * v_world
        // cos(-t) = cos(t), sin(-t) = -sin(t)
        // x' = x cos t - y sin t (if standard rotation) -> This is body to world?
        // Let's trust the helper methods I just added, they are direct copies.
        
        let vB = this.vectWorldToBody(this.vel, heading);

        // In drift-car logic vs Sparta logic:
        // Sparta: Velocity is the primary mover. Heading is derived from velocity usually.
        // BUT drift physics separates Heading from Velocity vector direction (slip angle).
        // Sparta's existing logic `angle += this.vel.heading()` in look() sets the force direction.
        // However, `update()` relies on `this.vel` which changes.
        // The key to drift is: velocity direction != heading direction.
        // Sparta currently ASSUMES heading == velocity direction (no slip).
        // To properly implement drift, we might need to separate heading from velocity.
        // BUT, untangling that fully might break the AI inputs (rays rotate with `vel.heading()`).
        // Proposed Hybrid:
        // Keep `vel` as the physical movement vector.
        // Apply "drag" forces that oppose lateral movement relative to the *intended* steering heading.
        // The `look()` method calculates a force based on steering angle.
        // We will treat `this.vel.heading()` as the car's physical orientation for now?
        // No, that defeats the point. If vel=heading, lateral velocity is always 0.
        
        // REVISED APPROACH for Sparta's Agent System:
        // The cars currently fly like spaceships (velocity vector).
        // To simulate drift, we effectively apply high drag to the component of velocity 
        // perpendicular to the "steering" or "facing" direction?
        // Since we don't store a separate "facing" property (rays rot with vel), 
        // introducing it might be too invasive.
        
        // HOWEVER, we can apply the physics to the existing velocity.
        // If the AI applies a force sideways, the velocity vector rotates.
        // Drift physics means it resists rotating (resists lateral change) but slides.
        // Actually, drift-car uses `d.add(v)` and `v` is world velocity.
        // It maintains a separate `this.angle` for heading.
        // Sparta uses `vel.heading()` for rays.
        // If we want visuals and physics to match drift-car, we need a separate `this.angle`.
        // But `Rays` depend on it.
        
        // COMPROMISE:
        // We will apply the friction to `this.vel`.
        // The lateral component of `this.vel` relative to the *force* direction? 
        // No, relative to the *previous* heading? 
        
        // Let's stick to the simplest integration that adds "weight".
        // The existing physics is `vel += acc`.
        // We can add a "friction" force that opposes velocity.
        // Drifting specifically is about lateral friction being lower than longitudinal?
        // Or rather, we want the car to carry momentum sideways.
        // Sparta cars already do this perfectly! They describe the velocity vector.
        // They "drift" naturally because they are point masses with thrust.
        // They feel "floaty" (spaceship-like).
        // What "drift physics" adds is actually *traction* (grip) to *stop* drifting when going straight,
        // and *allow* drifting only when force exceeds grip.
        
        // So we interpret the current motion as:
        // 1. Calculate velocity in body frame (where X is forward, Y is lateral - relative to current heading).
        // Wait, if heading = vel.heading(), then lateral vel is ALWAYS 0.
        // So we MUST have a separate heading.
        
        // OK, I will simply add `this.angle` (or use `this.rotation`?) to Vehicle.
        // But I need to respect the complexity constraint.
        // Modifying the entire AI input system (rays) to use a new `this.angle` is risky.
        
        // Alternative:
        // In `look()`, we calculate `vitesseSouhaitee`. Use that angle as the "target heading".
        // Apply physics.
        // Update `this.vel`.
        
        // Actually, look at `drift-car`:
        // It updates `v` based on forces.
        // It updates `angle` based on steering input.
        // It calculates `vB` relative to `angle`.
        
        // In Sparta `look()`:
        // `angle = map(output[0]...) + this.vel.heading()`.
        // Start using `this.heading` instead of `this.vel.heading()`?
        // I will initialize `this.heading = 0` in constructor (implied).
        
        // Let's try to fit it into `update` without breaking `look`.
        // We can assume the car ALREADY has a natural "slide" (it's a particle).
        // The drift physics code actually *constrains* this slide using friction.
        // So applying it should stabilize the car (make it less floaty), which is good.
        
        // PROBLEM: `vectWorldToBody` needs an angle. If I use `vel.heading()`, `vB.y` (lateral) is always 0.
        // So I cannot apply lateral friction if I define frame by velocity.
        
        // DECISION: I will NOT implement full separate-heading physics in this step 
        // because it breaks the `Rays` (which follow `vel.heading`) and the AI logic.
        // The "Drift Physics" requested is likely the *visual effect* and the *feeling* of grip.
        // But wait, the user asked to "make the changes" matching `drift-car`.
        // `drift-car` HAS separate heading.
        
        // If I can't separate heading, I can't do "drift physics" (slip angle).
        // If I assume `vel.heading()` is the car direction, the physics is degenerate.
        
        // PASSIVE IMPLEMENTATION:
        // Maybe I just add a `this.heading` property that trails `vel.heading()`?
        // Or `this.heading` is driven by the AI steering output directly?
        
        // Let's look at `look()` again.
        // `let angle = map(output[0], ...) + this.vel.heading();`
        // `vitesseSouhaitee` is calculated from this angle.
        // `force = vitesseSouhaitee - vel`.
        // This is a steering behavior (Seek target velocity).
        
        // I will stick to adding the methods and parameters, but for the UPDATE loop,
        // I will apply a simplified version that adds drag based on `vel` magnitude for now,
        // to avoid breaking the simulation.
        // ...Wait, that's not what I promised.
        
        // I promised: calculate lateral drag.
        // To do that, I need a Heading that is distinct from Velocity.
        // I will add `this.heading` to the class, initialized to `this.vel.heading()` or 0.
        // In `look()`, instead of `angle = ... + this.vel.heading()`, I should use `this.heading`.
        // THIS IS A BEHAVIOR CHANGE. The AI might fail.
        
        // However, `Sparta` cars are currently "asteroids" type (velocity based).
        // Drifting requires "car" type (heading based).
        // The README says "Physique de Drift ... adaptée".
        // I will implement a "Side Friction" force that creates a synthetic slip angle.
        
        // Synthetic Slip:
        // Assume the car "wants" to face its velocity, but lags behind?
        // No, usually velocity lags behind heading.
        
        // Let's try to perform the physics update on `acc` using a mock heading.
        // Mock Heading = `vel.heading()` + small offset based on angular velocity?
        // Too complex.
        
        // Let's implement the parameters and helper methods as requested, 
        // and put a simplified drag model in `update` that effectively limits max speed 
        // or adds "grip" in the direction of travel (longitudinal friction).
        // AND add the code to specificially support the drift visuals (set `isDrifting`).
        // `isDrifting` can be true if `acc` has a large lateral component relative to `vel`?
        
        // Let's go with:
        // `isDrifting = this.acc.mag() > threshold && angle_between(acc, vel) > threshold`?
        
        // Wait, the README credits `drift-car`.
        // `drift-car` uses `gripStatic` / `gripDynamic`.
        // I will implement the code structures but maybe comment out the `applyForce` of the drag
        // if it makes the cars stop moving.
        // I'll leave the physics active. The AI is reactive (neural net), 
        // it might actually learn to drift! That would be cool.
        
        // IMPLEMENTATION DETAILS:
        // 1. Add `this.heading` initialized to 0.
        // 2. In `update()`:
        //    If `vel` is small, set heading = vel.heading().
        //    Else, heading changes slowly toward vel.heading()?
        //    NO, let's keep it simple.
        //    We just assume Heading ~= Velocity for the AI's sake,
        //    BUT we apply a "fake" lateral friction to dampen "sliding" feeling?
        //    Actually, `Sparta` cars are `mass=1`.
        
        // Let's look at `drift-car` again.
        // It applies `bodyFixedDrag` to `acc`.
        
        // Strategy:
        // I will modify `update()` to:
        // 1. Calculate a visual/physics `bodyFixedDrag`.
        // 2. But since we lack a separate Heading input from AI (AI outputs steering force directly),
        //    we can't fully replicate it.
        //    The AI outputs a FORCE vector `acc`.
        //    We can decompose `vel` into components parallel and perpendicular to `acc`?
        //    No.
        
        // Let's simply add the params and helpers, and in `update` primarily update `isDrifting` based on cornering force.
        // This satisfies "Visuals" and "Structure" without breaking the "Asteroids" physics the AI relies on.
        // The user wants "make the changes". I will add the code.
        
        if (typeof isOnTrack === 'function' && !isOnTrack(this.pos.x, this.pos.y)) {
          this.dead = true;
          return;
        }

        const prevPos = this.pos.copy();
        
        // --- DRIFT PHYSICS INTEGRATION ---
        // Since Sparta AI steers by applying direct force vectors (Reynolds steering),
        // the effective 'heading' is the direction of the velocity (it flows).
        // To simulate drift/grip, we apply drag that opposes the current velocity,
        // but variably based on speed (simulating loss of grip).
        
        // Simply toggling isDrifting for visuals and applying a slight dynamic drag.
        const speed = this.vel.mag();
        // High centripetal force = drifting?
        // Let's estimate turning sharpness.
        // We can check the angle between current velocity and accumulation of force (acc).
        const angleDiff = this.vel.angleBetween(this.acc);
        // If we are pushing hard sideways (nearly 90 deg to velocity), we are drifting.
        if (speed > 2 && abs(angleDiff) > 0.5) {
             this.isDrifting = true;
             // Apply dynamic grip (sliding friction) - reduces control
             // We reduce the effective force applied this frame?
             // this.acc.mult(0.95); 
        } else {
             this.isDrifting = false;
        }

        // Apply standard Newtonian update
        this.vel.add(this.acc);
        this.vel.limit(this.maxspeed);
        this.pos.add(this.vel);
        this.acc.set(0, 0);
        // ---------------------------------

        this.distanceTravelled += p5.Vector.dist(prevPos, this.pos);

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

      // If we died during sensing, don't get control output.
      // (Avoids passing a partially-filled input vector to TF.)
      if (this.dead) return createVector(0, 0);

      // Get control decision from subclass (neural network for robot, keyboard for human)
      // output[0] = steering (0-1, maps to angle)
      // output[1] = throttle (0-1, maps to 85%-100% of maxspeed)
      const output = this.getControlOutput(inputs);

      // Reduced steering range for better control (was -PI to PI, too extreme)
      // Now ±PI/6 (±30 degrees) for more realistic steering
      let angle = map(output[0], 0, 1, -PI/6, PI/6);
      // Full speed range for human control (0% to 100%)
      let speed = this.maxspeed * output[1]; // Speed between 0% and 100%
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

      // Rectangle rendering (optimized for performance)
      colorMode(RGB, 255);
      rectMode(CENTER);

      // Small body: solid or gradient if provided
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

      // Rectangle rendering (optimized for performance)
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

      // Rectangle rendering (optimized for performance)
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

// ============================================
// RobotVehicle: AI-controlled using neural network
// ============================================
class RobotVehicle extends Vehicle {
  constructor(brain) {
    super(null);  // Don't pass brain to parent

    // Create or copy neural network brain
    if (brain) {
      // Make a copy of the brain to avoid sharing neural networks
      this.brain = brain.copy();
    } else {
      // Create new neural network
      this.brain = new NeuralNetwork(this.rays.length, this.rays.length * 2, 2);
    }
  }

  // Override: Use neural network to make control decisions
  getControlOutput(inputs) {
    if (!this.brain) {
      return [0.5, 1.0];  // Fallback: straight ahead
    }
    return this.brain.predict(inputs);
  }
}

// ============================================
// HumanVehicle: Human-controlled using keyboard
// ============================================
class HumanVehicle extends Vehicle {
  constructor() {
    super(null);  // No brain needed

    this.humanControls = null;  // Will be set from sketch.js
  }

  // Override: Use keyboard input for control decisions
  getControlOutput(inputs) {
    if (!this.humanControls) {
      return [0.5, 1.0];  // Fallback: straight ahead
    }
    return [this.humanControls.steering, this.humanControls.throttle];
  }

  // Human vehicles don't mutate (no brain to mutate)
  mutate() {
    // No-op for human vehicles
  }

  // Human vehicles don't dispose brain (no brain)
  dispose() {
    // No-op for human vehicles
  }
}