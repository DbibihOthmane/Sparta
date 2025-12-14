// TRAINING tunables (controlled by sliders)
let TOTAL = 100;  // Number of cars in population
let MUTATION_RATE = 0.1;
let LIFESPAN = 25;
let SIGHT = 50;

// Vehicle physics tunables (controlled by sliders)
// These are read by Vehicle instances (see vehicle.js)
let MAXSPEED = 5;
let MAXFORCE = 0.2;

let mode = "BUILDING"; // BUILDING -> ADJUSTING -> EDITING -> OBSTACLES -> TRAINING -> RACE

let selectedBrainName = null;
let generationCount = 0;

// Loaded-brains race mode (no GA): one vehicle per selected saved brain.
let raceBrainNames = [];
let raceVehicles = [];

let walls = [];
let population = [];
let savedVehicles = [];

let start, end;
let speedSlider;
let speedSliderLabel;

// -----------------------------
// Modern UI helpers (no alerts)
// -----------------------------
let uiToastEl = null;
let uiToastTimer = null;
let uiModalBackdrop = null;
let uiModalActive = false;
let uiBlockMouseUntil = 0;

// TRAINING controls as buttons
let trainingControlsPanel = null;
let btnTrainSave = null;
let btnTrainLoad = null;
let btnTrainDelete = null;
let btnTrainRace = null;
let btnTrainRaceHumanVsRobot = null;
let btnTrainNewTrack = null;

// RACE controls as buttons
let raceControlsPanel = null;
let btnRacePick = null;
let btnRaceBack = null;

// Human player controls
let humanControls = {
  steering: 0.5,   // 0-1 range (0.5 = center, straight)
  throttle: 0.85,  // 0-1 range (0 = stopped, 1.0 = full speed)
  accelerating: false,
  braking: false,
  turningLeft: false,
  turningRight: false,
  steeringAngle: 0,  // Direct angle control for better keyboard response
  speed: 0.85       // Current speed level (0-1)
};

// Camera system for following human player
let cameraState = {
  enabled: false,
  target: null,  // Reference to human vehicle
};

// Game state for human racing
let humanRaceState = {
  isGameOver: false,
  startTime: 0,
  survivalTime: 0,
  score: 0,
};

function ensureToast() {
  if (uiToastEl) return;
  uiToastEl = createDiv('');
  uiToastEl.addClass('ui-toast');
  uiToastEl.hide();
}

function showToast(message, ms = 1600) {
  ensureToast();
  if (!uiToastEl) return;
  uiToastEl.html(String(message || ''));
  uiToastEl.show();
  // addClass works even when hidden
  uiToastEl.addClass('show');
  if (uiToastTimer) clearTimeout(uiToastTimer);
  uiToastTimer = setTimeout(() => {
    try {
      uiToastEl.removeClass('show');
      uiToastEl.hide();
    } catch (_) {}
  }, ms);
}

function closeModal() {
  uiModalActive = false;
  // Prevent the click that closed the modal from also acting on the canvas.
  uiBlockMouseUntil = Date.now() + 250;
  if (uiModalBackdrop) {
    uiModalBackdrop.remove();
    uiModalBackdrop = null;
  }
}

function showModal({ title, message, kind = 'info', defaultValue = '', placeholder = '', okText = 'OK', cancelText = 'Cancel', onOk = null, onCancel = null }) {
  // kind: info | input | textarea | confirm | select | checklist
  closeModal();
  uiModalActive = true;

  uiModalBackdrop = createDiv('');
  uiModalBackdrop.addClass('ui-modal-backdrop');

  const modal = createDiv('');
  modal.addClass('ui-modal');
  uiModalBackdrop.child(modal);

  const h2 = createElement('h2', title || '');
  modal.child(h2);
  const p = createP(message || '');
  modal.child(p);

  let inputEl = null;
  if (kind === 'input') {
    inputEl = createInput(defaultValue || '');
    if (placeholder) inputEl.attribute('placeholder', placeholder);
    modal.child(inputEl);
  } else if (kind === 'textarea') {
    inputEl = createElement('textarea');
    inputEl.value(defaultValue || '');
    if (placeholder) inputEl.attribute('placeholder', placeholder);
    modal.child(inputEl);
  } else if (kind === 'select') {
    const opts = (window._uiModalOptions && Array.isArray(window._uiModalOptions)) ? window._uiModalOptions : [];
    inputEl = createElement('select');
    inputEl.addClass('ui-select');
    // Visible list (not dropdown)
    try { inputEl.elt.size = Math.min(10, Math.max(4, opts.length)); } catch (_) {}
    for (const opt of opts) {
      const o = createElement('option', opt);
      o.attribute('value', opt);
      inputEl.child(o);
    }
    if (defaultValue) {
      try { inputEl.value(defaultValue); } catch (_) {}
    }
    modal.child(inputEl);
  } else if (kind === 'checklist') {
    const opts = (window._uiModalOptions && Array.isArray(window._uiModalOptions)) ? window._uiModalOptions : [];
    const selectedSet = new Set(Array.isArray(defaultValue) ? defaultValue : []);

    const list = createDiv('');
    list.addClass('ui-checklist');
    modal.child(list);

    const addItem = (name) => {
      const row = createDiv('');
      row.addClass('ui-checkitem');
      const label = createDiv(String(name));
      label.style('flex', '1');
      const tick = createDiv('');
      tick.addClass('tick');
      row.child(label);
      row.child(tick);

      const sync = () => {
        if (selectedSet.has(name)) row.addClass('selected');
        else row.removeClass('selected');
      };
      sync();

      row.mousePressed(() => {
        if (selectedSet.has(name)) selectedSet.delete(name);
        else selectedSet.add(name);
        sync();
      });

      list.child(row);
    };

    for (const opt of opts) addItem(opt);

    inputEl = {
      _kind: 'checklist',
      getSelected: () => Array.from(selectedSet.values()),
    };
  }

  const row = createDiv('');
  row.addClass('row');
  modal.child(row);

  const btnCancel = createButton(cancelText);
  btnCancel.addClass('btn-secondary');
  btnCancel.mousePressed(() => {
    closeModal();
    if (typeof onCancel === 'function') onCancel();
  });

  const btnOk = createButton(okText);
  btnOk.addClass('btn-primary');
  btnOk.mousePressed(() => {
    let val = null;
    if (inputEl) {
      if (kind === 'checklist' && typeof inputEl.getSelected === 'function') {
        val = inputEl.getSelected();
      } else {
        try {
          val = inputEl.value();
        } catch (_) {
          val = null;
        }
      }
    }
    closeModal();
    if (typeof onOk === 'function') onOk(val);
  });

  if (kind === 'confirm') {
    row.child(btnCancel);
    row.child(btnOk);
  } else if (kind === 'info') {
    // only OK
    btnCancel.remove();
    row.child(btnOk);
  } else {
    row.child(btnCancel);
    row.child(btnOk);
  }

  // Focus input
  if (inputEl && inputEl.elt && typeof inputEl.elt.focus === 'function') {
    setTimeout(() => {
      try { inputEl.elt.focus(); } catch (_) {}
    }, 0);
  }
}

function showModalSelect({ title, message, options, selected = '', okText = 'Select', cancelText = 'Cancel', onOk = null, onCancel = null }) {
  window._uiModalOptions = Array.isArray(options) ? options.slice() : [];
  showModal({
    title,
    message,
    kind: 'select',
    defaultValue: selected,
    okText,
    cancelText,
    onOk: (val) => {
      window._uiModalOptions = null;
      if (typeof onOk === 'function') onOk(val);
    },
    onCancel: () => {
      window._uiModalOptions = null;
      if (typeof onCancel === 'function') onCancel();
    },
  });
}

function showModalMultiSelect({ title, message, options, selected = [], okText = 'Apply', cancelText = 'Cancel', onOk = null, onCancel = null }) {
  window._uiModalOptions = Array.isArray(options) ? options.slice() : [];
  showModal({
    title,
    message,
    kind: 'checklist',
    defaultValue: Array.isArray(selected) ? selected : [],
    okText,
    cancelText,
    onOk: (vals) => {
      window._uiModalOptions = null;
      const arr = Array.isArray(vals) ? vals : [];
      if (typeof onOk === 'function') onOk(arr);
    },
    onCancel: () => {
      window._uiModalOptions = null;
      if (typeof onCancel === 'function') onCancel();
    },
  });
}

// Expose for other scripts (trackBuilder/obstacleEditor)
window.showToast = showToast;
window.showModal = showModal;
window.showModalSelect = showModalSelect;
window.showModalMultiSelect = showModalMultiSelect;

function ensureTrainingControls() {
  if (trainingControlsPanel) return;
  trainingControlsPanel = createDiv('');
  trainingControlsPanel.addClass('ui-hud-panel');
  trainingControlsPanel.style('display', 'flex');
  // NOTE: p5.Element.style() uses JS style properties (camelCase), not CSS kebab-case.
  // User wants: horizontal row, top-middle.
  trainingControlsPanel.style('flexDirection', 'row');
  trainingControlsPanel.style('flexWrap', 'wrap');
  trainingControlsPanel.style('justifyContent', 'center');
  trainingControlsPanel.style('alignItems', 'center');
  trainingControlsPanel.style('gap', '18px');
  trainingControlsPanel.style('zIndex', '1000');
  trainingControlsPanel.hide();

  const mkBtn = (label, primary, onClick) => {
    const b = createButton(label);
    b.addClass(primary ? 'btn-primary' : 'btn-secondary');
    b.addClass('ui-btn-small');
    b.style('width', '110px');
    b.mousePressed(onClick);
    trainingControlsPanel.child(b);
    return b;
  };

  btnTrainSave = mkBtn('Save', true, () => doTrainingSave());
  btnTrainLoad = mkBtn('Load', false, () => doTrainingLoad());
  btnTrainDelete = mkBtn('Delete', false, () => doTrainingDelete());
  btnTrainRace = mkBtn('Race: Robot', false, () => doTrainingRace());
  btnTrainRaceHumanVsRobot = mkBtn('Race: H vs R', false, () => doTrainingRaceHumanVsRobot());
  btnTrainNewTrack = mkBtn('New track', false, () => doTrainingNewTrack());
}

function ensureRaceControls() {
  if (raceControlsPanel) return;
  raceControlsPanel = createDiv('');
  raceControlsPanel.addClass('ui-hud-panel');
  raceControlsPanel.style('display', 'flex');
  raceControlsPanel.style('flexDirection', 'row');
  raceControlsPanel.style('flexWrap', 'wrap');
  raceControlsPanel.style('justifyContent', 'center');
  raceControlsPanel.style('alignItems', 'center');
  raceControlsPanel.style('gap', '18px');
  raceControlsPanel.style('zIndex', '1000');
  raceControlsPanel.hide();

  const mkBtn = (label, primary, onClick) => {
    const b = createButton(label);
    b.addClass(primary ? 'btn-primary' : 'btn-secondary');
    b.addClass('ui-btn-small');
    b.style('width', '130px');
    b.mousePressed(onClick);
    raceControlsPanel.child(b);
    return b;
  };

  btnRacePick = mkBtn('Pick racers', true, () => doRacePickRacers());
  btnRaceBack = mkBtn('Go back', false, () => doRaceGoBack());
}

function showRaceControls(show) {
  ensureRaceControls();
  if (!raceControlsPanel) return;
  if (show) {
    raceControlsPanel.show();
    positionRaceControls();
  } else {
    raceControlsPanel.hide();
  }
}

function showTrainingControls(show) {
  ensureTrainingControls();
  if (!trainingControlsPanel) return;
  if (show) {
    trainingControlsPanel.show();
    positionTrainingControls();
  } else {
    trainingControlsPanel.hide();
  }
}

function positionTrainingControls() {
  if (!trainingControlsPanel) return;
  const w = (trainingControlsPanel.elt && trainingControlsPanel.elt.offsetWidth)
    ? trainingControlsPanel.elt.offsetWidth
    : 620;
  const x = Math.max(10, Math.round(width * 0.5 - w * 0.5));
  const y = 10;
  trainingControlsPanel.position(x, y);
}

function positionRaceControls() {
  if (!raceControlsPanel) return;
  const w = (raceControlsPanel.elt && raceControlsPanel.elt.offsetWidth)
    ? raceControlsPanel.elt.offsetWidth
    : 340;
  const x = Math.max(10, Math.round(width * 0.5 - w * 0.5));
  const y = 10;
  raceControlsPanel.position(x, y);
}

function doRaceGoBack() {
  // Return to training without resetting the track.
  population = [];
  savedVehicles = [];
  generationCount = 0;
  mode = 'TRAINING';
}

function doRacePickRacers() {
  const brains = BrainStorage.listAllBrains();
  if (!brains || brains.length === 0) {
    showToast('No saved brains');
    return;
  }
  const currently = (raceVehicles || []).map(v => (v && (v.displayName || v.brainName))).filter(Boolean);
  showModalMultiSelect({
    title: 'Change racers',
    message: 'Choose racers:',
    options: brains,
    selected: currently,
    okText: 'Apply',
    cancelText: 'Cancel',
    onOk: (chosen) => {
      if (!chosen || chosen.length === 0) {
        showToast('Pick at least one racer');
        return;
      }
      initRaceVehicles(chosen);
    },
  });
}

function doTrainingNewTrack() {
  mode = "BUILDING";
  population = [];
  savedVehicles = [];
  generationCount = 0;
  selectedBrainName = null;
  trackBuilder.toggle();
}

function doTrainingSave() {
  let candidates = [];
  candidates = candidates.concat(population, savedVehicles);
  if (candidates.length === 0) {
    showToast('No vehicles to save');
    return;
  }
  let bestVehicle = candidates[0];
  for (let v of candidates) {
    if (v.fitness > bestVehicle.fitness) bestVehicle = v;
  }
  if (!bestVehicle) return;
  const defaultName = `champion_gen${generationCount}`;
  showModal({
    title: 'Save brain',
    message: 'Enter a name (optional). Leave empty to use the default.',
    kind: 'input',
    // Important: keep this EMPTY so repeated saves don't silently overwrite the same name.
    defaultValue: '',
    placeholder: defaultName,
    okText: 'Save',
    cancelText: 'Cancel',
    onOk: (val) => {
      const name = (val || '').trim();
      const ok = BrainStorage.saveBestBrain(bestVehicle, name || null, getCurrentTrainingParams());
      if (ok) showToast('Saved');
      else {
        showModal({
          title: 'Save failed',
          message: 'Could not save the model (storage may be full or the model is invalid).',
          kind: 'info',
          okText: 'OK',
        });
      }
    },
  });
}

function doTrainingLoad() {
  const brains = BrainStorage.listAllBrains();
  if (!brains || brains.length === 0) {
    showModal({
      title: 'No model available',
      message: 'You have to train a model , actually no model is available',
      kind: 'info',
      okText: 'OK',
    });
    return;
  }
  showModalSelect({
    title: 'Load brain',
    message: 'Choose a saved brain:',
    options: brains,
    selected: selectedBrainName || '',
    okText: 'Load',
    cancelText: 'Cancel',
    onOk: (choice) => {
      if (!choice || !brains.includes(choice)) {
        showToast('No selection');
        return;
      }
      selectedBrainName = choice;
      population = [];
      savedVehicles = [];
      generationCount = 0;
      showToast('Loaded: ' + selectedBrainName);
    },
  });
}

function doTrainingDelete() {
  const brains = BrainStorage.listAllBrains();
  if (!brains || brains.length === 0) {
    showToast('No saved brains');
    return;
  }
  showModalSelect({
    title: 'Delete brain',
    message: 'Choose a saved brain to delete:',
    options: brains,
    selected: '',
    okText: 'Next',
    cancelText: 'Cancel',
    onOk: (toDelete) => {
      if (!toDelete || !brains.includes(toDelete)) {
        showToast('No selection');
        return;
      }
      showModal({
        title: 'Confirm delete',
        message: `Delete "${toDelete}"? This cannot be undone.`,
        kind: 'confirm',
        okText: 'Delete',
        cancelText: 'Cancel',
        onOk: () => {
          BrainStorage.deleteBrain(toDelete);
          showToast('Deleted');
        },
      });
    },
  });
}

function doTrainingRace() {
  const brains = BrainStorage.listAllBrains();
  if (!brains || brains.length === 0) {
    showModal({
      title: 'No model available',
      message: 'You have to train a model , actually no model is available',
      kind: 'info',
      okText: 'OK',
    });
    return;
  }
  showModalMultiSelect({
    title: 'Start race',
    message: 'Click names to toggle selection:',
    options: brains,
    selected: [],
    okText: 'Start',
    cancelText: 'Cancel',
    onOk: (chosen) => {
      if (!chosen || chosen.length === 0) {
        showToast('Pick at least one racer');
        return;
      }
      initRaceVehicles(chosen, false);  // false = no human player
      if (raceVehicles.length === 0) {
        showToast('Could not load selected brains');
        return;
      }
      mode = 'RACE';
    },
  });
}

function doTrainingRaceHumanVsRobot() {
  const brains = BrainStorage.listAllBrains();
  if (!brains || brains.length === 0) {
    showModal({
      title: 'No model available',
      message: 'You need at least one trained model to race against',
      kind: 'info',
      okText: 'OK',
    });
    return;
  }
  showModalMultiSelect({
    title: 'Human vs Robot Race',
    message: 'Select AI opponents to race against (you control the human car with arrow keys):',
    options: brains,
    selected: [],
    okText: 'Start Race',
    cancelText: 'Cancel',
    onOk: (chosen) => {
      if (!chosen || chosen.length === 0) {
        showToast('Pick at least one AI opponent');
        return;
      }
      initRaceVehicles(chosen, true);  // true = include human player
      if (raceVehicles.length === 0) {
        showToast('Could not load selected brains');
        return;
      }
      mode = 'RACE';
      showToast('Use ARROW KEYS to control your car!', 2500);
    },
  });
}

// TRAINING parameter sliders (minimal set requested)
let totalCarsSlider;
let mutationRateSlider;
let lifespanSlider;
let maxSpeedSlider;
let maxForceSlider;
let sightSlider;

let trainingParamLabels = [];

function resetTrainingRun() {
  // Keep the current track, checkpoints, walls, obstacles.
  // Only reset the evolving population and generation counters.
  population = [];
  // Dispose old brains to avoid TF memory growth
  for (const v of savedVehicles) {
    if (v && typeof v.dispose === 'function') v.dispose();
  }
  savedVehicles = [];
  generationCount = 0;
  resetBestCarVfx();
  activeCheckpoint = null;
  lastCheckpointHit = null;
}

function setTrainingParamsFromSliders() {
  if (totalCarsSlider) TOTAL = Number(totalCarsSlider.value());
  if (mutationRateSlider) MUTATION_RATE = Number(mutationRateSlider.value());
  if (lifespanSlider) LIFESPAN = Number(lifespanSlider.value());
  if (maxSpeedSlider) MAXSPEED = Number(maxSpeedSlider.value());
  if (maxForceSlider) MAXFORCE = Number(maxForceSlider.value());
  if (sightSlider) SIGHT = Number(sightSlider.value());
}

function getCurrentTrainingParams() {
  return {
    totalCars: TOTAL,
    mutationRate: MUTATION_RATE,
    lifespan: LIFESPAN,
    maxspeed: MAXSPEED,
    maxforce: MAXFORCE,
    sight: SIGHT,
  };
}

function applySavedParamsToGlobalsAndSliders(params) {
  if (!params) return;
  if (typeof params.totalCars === 'number') TOTAL = params.totalCars;
  if (typeof params.mutationRate === 'number') MUTATION_RATE = params.mutationRate;
  if (typeof params.lifespan === 'number') LIFESPAN = params.lifespan;
  if (typeof params.maxspeed === 'number') MAXSPEED = params.maxspeed;
  if (typeof params.maxforce === 'number') MAXFORCE = params.maxforce;
  if (typeof params.sight === 'number') SIGHT = params.sight;

  if (totalCarsSlider && typeof params.totalCars === 'number') totalCarsSlider.value(params.totalCars);
  if (mutationRateSlider && typeof params.mutationRate === 'number') mutationRateSlider.value(params.mutationRate);
  if (lifespanSlider && typeof params.lifespan === 'number') lifespanSlider.value(params.lifespan);
  if (maxSpeedSlider && typeof params.maxspeed === 'number') maxSpeedSlider.value(params.maxspeed);
  if (maxForceSlider && typeof params.maxforce === 'number') maxForceSlider.value(params.maxforce);
  if (sightSlider && typeof params.sight === 'number') sightSlider.value(params.sight);
}

function applyParamsToVehicles(vehicles) {
  if (!vehicles) return;
  for (const v of vehicles) {
    if (!v) continue;
    v.maxspeed = MAXSPEED;
    v.maxforce = MAXFORCE;
    v.sight = SIGHT;
  }
}

function showTrainingParamUI(show) {
  // Reordered to match setup: CARS moved to bottom
  const sliders = [mutationRateSlider, lifespanSlider, maxSpeedSlider, maxForceSlider, sightSlider, totalCarsSlider];
  for (const s of sliders) {
    if (!s) continue;
    if (show) s.show();
    else s.hide();
  }
  for (const d of trainingParamLabels) {
    if (!d) continue;
    if (show) d.show();
    else d.hide();
  }
}

function positionTrainingParamUI() {
  const sliders = [totalCarsSlider, mutationRateSlider, lifespanSlider, maxSpeedSlider, maxForceSlider, sightSlider];
  const w = 220;
  const margin = 14;
  // ALWAYS position on right side
  const left = width - w - margin;
  let y = 80;  // to match setup() starting position

  for (let i = 0; i < sliders.length; i++) {
    const label = trainingParamLabels[i];
    const slider = sliders[i];
    if (label) label.position(left, y);
    y += 16;
    if (slider) slider.position(left, y);
    y += 28;
  }
}

// Visualization-only: keep only one checkpoint highlight active at a time.
let activeCheckpoint = null;

// Visualization-only: last checkpoint hit metadata (rendered on the best car)
let lastCheckpointHit = null; // { frame, dx, dy, halfLen, frontOffset }

function setLastCheckpointHitFromCar(bestCar, crossedCheckpoint) {
  if (!bestCar || !bestCar.pos) return;

  // Direction of the checkpoint line (so the flash looks like the checkpoint)
  let dx = 1;
  let dy = 0;
  let halfLen = 30;
  if (crossedCheckpoint && crossedCheckpoint.a && crossedCheckpoint.b) {
    const vx = crossedCheckpoint.b.x - crossedCheckpoint.a.x;
    const vy = crossedCheckpoint.b.y - crossedCheckpoint.a.y;
    const len = Math.hypot(vx, vy) || 1;
    dx = vx / len;
    dy = vy / len;
    halfLen = Math.min(60, len * 0.5);
  }

  // IMPORTANT: don't store x/y here.
  // When training speed runs multiple sim cycles per draw(), the car moves
  // after crossing the checkpoint. If we stored x/y, the flash would appear
  // behind the car by render time.
  lastCheckpointHit = {
    frame: frameCount,
    dx,
    dy,
    halfLen,
    // Put the flash slightly toward the car front at render time.
    frontOffset: 7,
  };
}

function drawCheckpointHitMarker(bestCar, ttlFrames = 10) {
  if (!lastCheckpointHit) return;
  if (!bestCar || !bestCar.pos) return;
  const age = frameCount - lastCheckpointHit.frame;
  if (age < 0 || age > ttlFrames) return;

  // Anchor the flash to the CURRENT best car position so it stays on the car
  // even when many simulation cycles were executed earlier in this frame.
  let x = bestCar.pos.x;
  let y = bestCar.pos.y;
  if (bestCar.vel && lastCheckpointHit.frontOffset) {
    const v = bestCar.vel.copy ? bestCar.vel.copy() : null;
    if (v && v.mag && v.mag() > 0.001) {
      v.normalize();
      x += v.x * lastCheckpointHit.frontOffset;
      y += v.y * lastCheckpointHit.frontOffset;
    }
  }

  const t = 1 - age / ttlFrames;
  const alpha = 255 * t;

  push();
  blendMode(ADD);

  // Flash segment aligned with the checkpoint direction
  const x0 = x - lastCheckpointHit.dx * lastCheckpointHit.halfLen;
  const y0 = y - lastCheckpointHit.dy * lastCheckpointHit.halfLen;
  const x1 = x + lastCheckpointHit.dx * lastCheckpointHit.halfLen;
  const y1 = y + lastCheckpointHit.dy * lastCheckpointHit.halfLen;

  strokeCap(ROUND);
  // Glow
  stroke(255, 90, 230, alpha * 0.35);
  strokeWeight(10);
  line(x0, y0, x1, y1);
  // Core
  stroke(255, 255, 255, alpha * 0.75);
  strokeWeight(2.5);
  line(x0, y0, x1, y1);

  blendMode(BLEND);
  pop();
}

// Visualization-only: trail behind the highlighted/best car.
let bestCarTrail = [];
const BEST_CAR_TRAIL_MAX = 55;
const BEST_CAR_TRAIL_MIN_DIST = 3.5;
// How long trail points remain visible (in frames). Lower = fades faster.
const BEST_CAR_TRAIL_TTL = 7;

// Visualization-only: particles emitted by the highlighted/best car.
let bestCarParticles = [];
const BEST_CAR_PARTICLES_MAX = 60;
const BEST_CAR_PARTICLES_SPAWN = 2;

// Visualization-only (RACE): per-car trails/particles (no impact on logic)
let raceCarTrails = new Map();
let raceCarParticles = new Map();
const RACE_CAR_TRAIL_MAX = 35;
const RACE_CAR_TRAIL_MIN_DIST = 3;
const RACE_CAR_TRAIL_TTL = 10;
const RACE_CAR_PARTICLES_MAX = 25;
const RACE_CAR_PARTICLES_SPAWN = 1;


// Shared VFX palette (purple/pink)
const VFX_HUE_BASE = 285;

function resetBestCarVfx() {
  bestCarTrail = [];
  bestCarParticles = [];
}

function resetRaceCarVfx() {
  raceCarTrails = new Map();
  raceCarParticles = new Map();
}

function getRaceTrailFor(v) {
  if (!v) return null;
  if (!raceCarTrails.has(v)) raceCarTrails.set(v, []);
  return raceCarTrails.get(v);
}

function getRaceParticlesFor(v) {
  if (!v) return null;
  if (!raceCarParticles.has(v)) raceCarParticles.set(v, []);
  return raceCarParticles.get(v);
}

function updateRaceCarTrail(v) {
  if (!v || !v.pos) return;
  const trail = getRaceTrailFor(v);
  if (!trail) return;

  const p = { x: v.pos.x, y: v.pos.y, frame: frameCount };
  const last = trail.length ? trail[trail.length - 1] : null;
  if (!last || dist(last.x, last.y, p.x, p.y) >= RACE_CAR_TRAIL_MIN_DIST) {
    trail.push(p);
    if (trail.length > RACE_CAR_TRAIL_MAX) {
      trail.splice(0, trail.length - RACE_CAR_TRAIL_MAX);
    }
  }

  const cutoff = frameCount - RACE_CAR_TRAIL_TTL;
  while (trail.length && trail[0].frame < cutoff) trail.shift();
}

function spawnRaceCarParticles(v) {
  if (!v || !v.pos) return;
  const particles = getRaceParticlesFor(v);
  if (!particles) return;

  const heading = (v.vel && typeof v.vel.heading === 'function') ? v.vel.heading() : 0;
  const speed = (v.vel && typeof v.vel.mag === 'function') ? v.vel.mag() : 0;

  for (let i = 0; i < RACE_CAR_PARTICLES_SPAWN; i++) {
    const jitter = random(-0.6, 0.6);
    const back = random(6, 14) + speed * 1.2;
    const angle = heading + Math.PI + jitter;

    const px = v.pos.x + Math.cos(angle) * back + random(-2, 2);
    const py = v.pos.y + Math.sin(angle) * back + random(-2, 2);

    const vx = Math.cos(angle) * random(0.3, 1.4) + random(-0.2, 0.2);
    const vy = Math.sin(angle) * random(0.3, 1.4) + random(-0.2, 0.2);

    particles.push({
      x: px,
      y: py,
      vx,
      vy,
      life: random(4, 9),
      maxLife: 9,
      col: v.renderColor || null,
    });
  }

  if (particles.length > RACE_CAR_PARTICLES_MAX) {
    particles.splice(0, particles.length - RACE_CAR_PARTICLES_MAX);
  }
}

function updateRaceCarParticles(v) {
  const particles = getRaceParticlesFor(v);
  if (!particles) return;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life -= 1.6;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawRaceCarTrail(v) {
  const trail = getRaceTrailFor(v);
  if (!trail || trail.length < 2) return;

  const baseCol = v && v.renderColor ? v.renderColor : null;

  push();
  blendMode(ADD);
  noFill();
  strokeCap(ROUND);
  strokeJoin(ROUND);
  colorMode(HSB, 360, 100, 100, 255);

  // Derive hue from car color if available; else fall back to global palette.
  let baseHue = VFX_HUE_BASE;
  if (baseCol) {
    baseHue = hue(baseCol);
  }

  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const t = i / (trail.length - 1);
    const age = frameCount - b.frame;
    const life = constrain(1 - age / RACE_CAR_TRAIL_TTL, 0, 1);
    const fade = Math.pow(life, 2.4);
    const alpha = Math.min(255, 10 + 220 * fade);
    const hueV = (baseHue + 35 * t) % 360;

    stroke(hueV, 98, 100, alpha * 0.32);
    strokeWeight(8 - 5 * t);
    line(a.x, a.y, b.x, b.y);

    stroke(0, 0, 100, alpha * 0.85);
    strokeWeight(2.0 - 1.0 * t);
    line(a.x, a.y, b.x, b.y);
  }

  colorMode(RGB, 255);
  blendMode(BLEND);
  pop();
}

function drawRaceCarParticles(v) {
  const particles = getRaceParticlesFor(v);
  if (!particles || particles.length === 0) return;

  push();
  blendMode(ADD);
  noStroke();
  colorMode(RGB, 255);

  for (const p of particles) {
    const t = constrain(p.life / p.maxLife, 0, 1);
    const a = 110 * Math.pow(t, 2.5);
    if (p.col) {
      fill(red(p.col), green(p.col), blue(p.col), a);
      circle(p.x, p.y, 2.2 + 3.6 * (1 - t));
      fill(255, 255, 255, a * 0.35);
      circle(p.x, p.y, 5 + 7 * (1 - t));
    } else {
      fill(255, 120, 220, a);
      circle(p.x, p.y, 2.2 + 3.6 * (1 - t));
    }
  }

  blendMode(BLEND);
  pop();
}

function resetBestCarTrail() {
  resetBestCarVfx();
}

function updateBestCarTrail(bestCar) {
  if (!bestCar || !bestCar.pos) return;
  const p = { x: bestCar.pos.x, y: bestCar.pos.y, frame: frameCount };
  const last = bestCarTrail.length ? bestCarTrail[bestCarTrail.length - 1] : null;
  if (!last || dist(last.x, last.y, p.x, p.y) >= BEST_CAR_TRAIL_MIN_DIST) {
    bestCarTrail.push(p);
    if (bestCarTrail.length > BEST_CAR_TRAIL_MAX) {
      bestCarTrail.splice(0, bestCarTrail.length - BEST_CAR_TRAIL_MAX);
    }
  }

  // Prune by age so the footprint doesn't persist on the map.
  const cutoff = frameCount - BEST_CAR_TRAIL_TTL;
  while (bestCarTrail.length && bestCarTrail[0].frame < cutoff) {
    bestCarTrail.shift();
  }
}

function spawnBestCarParticles(bestCar) {
  if (!bestCar || !bestCar.pos) return;
  const heading = (bestCar.vel && typeof bestCar.vel.heading === 'function') ? bestCar.vel.heading() : 0;
  const speed = (bestCar.vel && typeof bestCar.vel.mag === 'function') ? bestCar.vel.mag() : 0;

  // Spawn a few sparks near the car, biased backward (opposite heading)
  for (let i = 0; i < BEST_CAR_PARTICLES_SPAWN; i++) {
    const jitter = random(-0.7, 0.7);
    const back = random(6, 16) + speed * 1.5;
    const angle = heading + Math.PI + jitter;

    const px = bestCar.pos.x + Math.cos(angle) * back + random(-2, 2);
    const py = bestCar.pos.y + Math.sin(angle) * back + random(-2, 2);

    const vx = Math.cos(angle) * random(0.4, 1.8) + random(-0.3, 0.3);
    const vy = Math.sin(angle) * random(0.4, 1.8) + random(-0.3, 0.3);

    bestCarParticles.push({
      x: px,
      y: py,
      vx,
      vy,
      life: random(4, 10),
      maxLife: 10,
      // Purple/pink palette (avoid cyan/blue)
      hue: (VFX_HUE_BASE + random(-10, 70)) % 360
    });
  }

  if (bestCarParticles.length > BEST_CAR_PARTICLES_MAX) {
    bestCarParticles.splice(0, bestCarParticles.length - BEST_CAR_PARTICLES_MAX);
  }
}

function updateBestCarParticles() {
  for (let i = bestCarParticles.length - 1; i >= 0; i--) {
    const p = bestCarParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life -= 1.7;
    if (p.life <= 0) bestCarParticles.splice(i, 1);
  }
}

function drawBestCarParticles() {
  if (bestCarParticles.length === 0) return;
  push();
  blendMode(ADD);
  colorMode(HSB, 360, 100, 100, 255);
  noStroke();

  for (const p of bestCarParticles) {
    const t = constrain(p.life / p.maxLife, 0, 1);
    const a = 120 * Math.pow(t, 2.6);
    fill(p.hue, 90, 100, a);
    circle(p.x, p.y, 2.5 + 4 * (1 - t));
    fill((p.hue + 35) % 360, 70, 100, a * 0.25);
    circle(p.x, p.y, 6 + 8 * (1 - t));
  }

  colorMode(RGB, 255);
  blendMode(BLEND);
  pop();
}

function drawBestCarTrail() {
  if (bestCarTrail.length < 2) return;
  push();
  blendMode(ADD);

  noFill();
  strokeCap(ROUND);
  strokeJoin(ROUND);
  colorMode(HSB, 360, 100, 100, 255);

  // Bright near head, but fades out very quickly (TTL-based)
  for (let i = 1; i < bestCarTrail.length; i++) {
    const a = bestCarTrail[i - 1];
    const b = bestCarTrail[i];

    const t = i / (bestCarTrail.length - 1); // 0..1 tail->head

    const age = frameCount - b.frame;
    const life = constrain(1 - age / BEST_CAR_TRAIL_TTL, 0, 1);
    const fade = Math.pow(life, 2.6);
    const alpha = Math.min(255, 10 + 245 * fade);
    const hue = (VFX_HUE_BASE + 50 * t) % 360;

    // Glow
    stroke(hue, 98, 100, alpha * 0.34);
    strokeWeight(10 - 6 * t);
    line(a.x, a.y, b.x, b.y);

    // Core
    stroke(0, 0, 100, alpha * 0.9);
    strokeWeight(2.5 - 1.2 * t);
    line(a.x, a.y, b.x, b.y);
  }

  // Small head glow (keeps it readable)
  const head = bestCarTrail[bestCarTrail.length - 1];
  noStroke();
  fill(VFX_HUE_BASE, 98, 100, 105);
  circle(head.x, head.y, 14);
  fill(0, 0, 100, 90);
  circle(head.x, head.y, 6);

  colorMode(RGB, 255);
  blendMode(BLEND);
  pop();
}



let inside = [];
let outside = [];
let checkpoints = [];

function pointInPolygon(x, y, poly) {
  if (!poly || poly.length < 3) return false;
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) c = !c;
  }
  return c;
}

// True iff the point is on the drivable track surface.
// Track = inside outer polygon AND outside inner polygon (if any).
function isOnTrack(x, y) {
  if (!outside || outside.length < 3) return true; // track not built yet
  const inOuter = pointInPolygon(x, y, outside);
  if (!inOuter) return false;
  if (inside && inside.length >= 3) {
    const inInner = pointInPolygon(x, y, inside);
    if (inInner) return false;
  }
  return true;
}

// -----------------------------
// Visual styling helpers (track)
// -----------------------------
function drawStyledTrack() {
  if (!outside || outside.length < 3) return;

  push();

  // Track surface (outer contour with inner hole when available)
  noStroke();
  fill(18);
  beginShape();
  for (const p of outside) vertex(p.x, p.y);
  if (inside && inside.length >= 3) {
    beginContour();
    for (let i = inside.length - 1; i >= 0; i--) {
      const p = inside[i];
      vertex(p.x, p.y);
    }
    endContour();
  }
  endShape(CLOSE);

  // Simple outline only (no aura/glow)
  strokeCap(ROUND);
  strokeJoin(ROUND);
  noFill();
  blendMode(BLEND);

  // Smooth gradient outline (static): warm "sunset" (gold -> hot pink -> violet).
  // Use RGB lerp to avoid ugly hue-wrap artifacts.
  const drawGradientLoop = (pts) => {
    if (!pts || pts.length < 2) return;
    const n = pts.length;

    // 3-stop palette in RGB (no cyan/blue, more premium-looking)
    colorMode(RGB, 255);
    const c1 = color(255, 105, 210, 255); // magenta (closer to the rest)
    const c2 = color(255, 80, 175, 255);  // hot pink
    const c3 = color(170, 70, 255, 255);  // violet

    const ease = (x) => x * x * (3 - 2 * x); // smoothstep
    const grad = (t) => {
      const u = ease(constrain(t, 0, 1));
      if (u < 0.5) return lerpColor(c1, c2, u / 0.5);
      return lerpColor(c2, c3, (u - 0.5) / 0.5);
    };

    // Glow pass (additive)
    blendMode(ADD);
    strokeWeight(12);
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const t = i / n;
      const col = grad(t);
      stroke(red(col), green(col), blue(col), 55);
      line(a.x, a.y, b.x, b.y);
    }

    // Core pass (clean + bright)
    blendMode(BLEND);
    strokeWeight(4.4);
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const t = i / n;
      const col = grad(t);
      stroke(red(col), green(col), blue(col), 200);
      line(a.x, a.y, b.x, b.y);
    }

    // Thin white highlight for crispness
    colorMode(RGB, 255);
    stroke(255, 255, 255, 55);
    strokeWeight(1.5);
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      line(a.x, a.y, b.x, b.y);
    }
  };

  drawGradientLoop(outside);
  if (inside && inside.length >= 3) drawGradientLoop(inside);

  pop();
}

function drawStyledWalls() {
  // Walls are still used for collision/sensing; here we just draw them nicer.
  if (!walls || walls.length === 0) return;
  push();
  strokeCap(ROUND);
  blendMode(BLEND);
  stroke(255, 255, 255, 55);
  strokeWeight(2);

  for (const w of walls) {
    line(w.a.x, w.a.y, w.b.x, w.b.y);
  }
  pop();
}





function buildTrackFromPoints(points, pathWidth) {
  checkpoints = [];
  walls = [];
  clearObstacles();
  resetBestCarVfx();
  activeCheckpoint = null;
  lastCheckpointHit = null;

  // -----------------------------
  // 1) Smooth the center path first for consistency (but since now smoothed in builder, this reinforces if needed)
  // Increased samples for better smoothness and distribution
  // -----------------------------
  const samplesPerSegment = 50;  // Increased for smoother offsets and checkpoints
  let smoothPath = [];

  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    for (let k = 0; k < samplesPerSegment; k++) {
      const t = k / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;

      const x = 0.5 * (
        2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );
      const y = 0.5 * (
        2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );

      smoothPath.push(createVector(x, y));
    }
  }

  // -----------------------------
  // 2) Walls inner/outer with Clipper USING SMOOTH PATH for better alignment
  // -----------------------------
  const scale = 100;
  let path = smoothPath.map(p => ({
    X: Math.round(p.x * scale),
    Y: Math.round(p.y * scale)
  }));

  // Ensure counter-clockwise orientation
  if (!ClipperLib.Clipper.Orientation(path)) {
    path.reverse();
    smoothPath = smoothPath.slice().reverse();
  }

  const co = new ClipperLib.ClipperOffset();
  co.ArcTolerance = 12; // Rounded corners

  // Outer wall
  co.Clear();
  co.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  let outerScaled = [];
  co.Execute(outerScaled, pathWidth * scale);
  let outerPoints = outerScaled[0].map(p =>
    createVector(p.X / scale, p.Y / scale)
  );

  // Inner wall
  co.Clear();
  co.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  let innerScaled = [];
  co.Execute(innerScaled, -pathWidth * scale);
  let innerPoints = innerScaled[0] && innerScaled[0].length > 3
    ? innerScaled[0].map(p => createVector(p.X / scale, p.Y / scale))
    : [];

  // Store polygons for rendering (visual only)
  outside = outerPoints;
  inside = innerPoints;

  // Wall segments (white)
  for (let i = 0; i < innerPoints.length; i++) {
    const a = innerPoints[i];
    const b = innerPoints[(i + 1) % innerPoints.length];
    walls.push(new Boundary(a.x, a.y, b.x, b.y));
  }
  for (let i = 0; i < outerPoints.length; i++) {
    const a = outerPoints[i];
    const b = outerPoints[(i + 1) % outerPoints.length];
    walls.push(new Boundary(a.x, a.y, b.x, b.y));
  }

  // -----------------------------
  // Geometric helpers
  // -----------------------------
  function cross(v, w) {
    return v.x * w.y - v.y * w.x;
  }

  function lineSegIntersection(p, r, a, b) {
    const s = p5.Vector.sub(b, a);
    const rxs = cross(r, s);
    if (Math.abs(rxs) < 1e-9) return null; // Parallel

    const qp = p5.Vector.sub(a, p);
    const t = cross(qp, s) / rxs;
    const u = cross(qp, r) / rxs;

    if (u < 0 || u > 1) return null; // Outside segment

    const hit = p5.Vector.add(p, p5.Vector.mult(r, t));
    return { point: hit, t: t };
  }

  function intersectRayWithPath(center, dir, pathPoints) {
    let best = null;
    let bestT = Infinity;

    for (let i = 0; i < pathPoints.length; i++) {
      const a = pathPoints[i];
      const b = pathPoints[(i + 1) % pathPoints.length];
      const res = lineSegIntersection(center, dir, a, b);
      if (res && res.t > 0 && res.t < bestT) {
        bestT = res.t;
        best = res.point;
      }
    }
    return best;
  }

  function closestPointOnSegment(p, a, b) {
    const ab = p5.Vector.sub(b, a);
    const ap = p5.Vector.sub(p, a);
    const projLen = p5.Vector.dot(ap, ab) / ab.magSq();
    if (projLen < 0) return a.copy();
    if (projLen > 1) return b.copy();
    const proj = ab.mult(projLen);
    return p5.Vector.add(a, proj);
  }

  function closestPointOnPath(point, pathPoints) {
    if (pathPoints.length === 0) return null;
    let bestDist = Infinity;
    let bestPoint = null;
    for (let i = 0; i < pathPoints.length; i++) {
      const a = pathPoints[i];
      const b = pathPoints[(i + 1) % pathPoints.length];
      const closest = closestPointOnSegment(point, a, b);
      const d = p5.Vector.dist(point, closest);
      if (d < bestDist) {
        bestDist = d;
        bestPoint = closest;
      }
    }
    return bestPoint;
  }

  function resampleToUniform(points, spacing) {
    const resampled = [];
    let totalLength = 0;
    const np = points.length;
    for (let i = 0; i < np; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % np];
      totalLength += p5.Vector.dist(p1, p2);
    }

    resampled.push(points[0].copy());
    let target = spacing;
    let accum = 0;
    let i = 0;
    while (target < totalLength) {
      let added = false;
      while (!added) {
        const p1 = points[i];
        const p2 = points[(i + 1) % np];
        const segLen = p5.Vector.dist(p1, p2);
        if (accum + segLen >= target) {
          const remaining = target - accum;
          const frac = remaining / segLen;
          const pos = p5.Vector.lerp(p1, p2, frac);
          if (p5.Vector.dist(pos, resampled[0]) < spacing * 0.5 && resampled.length > 1) {
            break;
          }
          resampled.push(pos);
          added = true;
        } else {
          accum += segLen;
          i = (i + 1) % np;
          if (i === 0) break;
        }
      }
      if (!added) break;
      target += spacing;
    }
    return resampled;
  }

  // -----------------------------
  // 3) Checkpoints (blue lines) - Improved with relaxed skips for better distribution
  // -----------------------------
  const denseSpacing = 1;        // Finer dense for accurate tangents
  const checkpointSpacing = 20;  // Uniform along arc length
  const marginPx = 2;            // Margin from walls
  const maxCheckpointLength = pathWidth * 5;  // Relaxed to allow more variation

  const denseCenter = resampleToUniform(smoothPath, denseSpacing);
  const checkpointCenters = resampleToUniform(smoothPath, checkpointSpacing);

  for (let j = 0; j < checkpointCenters.length; j++) {
    const center = checkpointCenters[j];

    // Find closest index in denseCenter
    let minDist = Infinity;
    let k_best = 0;
    for (let k = 0; k < denseCenter.length; k++) {
      let d = p5.Vector.dist(center, denseCenter[k]);
      if (d < minDist) {
        minDist = d;
        k_best = k;
      }
    }

    const len = denseCenter.length;
    const prev = denseCenter[(k_best - 1 + len) % len];
    const next = denseCenter[(k_best + 1) % len];
    const dir = p5.Vector.sub(next, prev).normalize();
    const perp = createVector(-dir.y, dir.x); // Inward for CCW

    // Intersections with inner and outer
    let hitInner = innerPoints.length > 0 ? intersectRayWithPath(center, perp, innerPoints) : null;
    if (innerPoints.length > 0 && !hitInner) {
      hitInner = closestPointOnPath(center, innerPoints);
    }
    const outerDir = createVector(-perp.x, -perp.y);
    let hitOuter = intersectRayWithPath(center, outerDir, outerPoints);
    if (!hitOuter) {
      hitOuter = closestPointOnPath(center, outerPoints);
    }

    if (innerPoints.length > 0 && (!hitInner || !hitOuter)) continue;
    if (innerPoints.length === 0 || !hitOuter) continue;

    // Relaxed distance check to reduce skips and improve distribution
    if (innerPoints.length > 0 && p5.Vector.dist(center, hitInner) > pathWidth * 2) continue;
    if (p5.Vector.dist(center, hitOuter) > pathWidth * 2) continue;

    // Shorten slightly
    const innerPos = hitInner || center;
    const v = p5.Vector.sub(hitOuter, innerPos);
    const len_v = v.mag();
    if (len_v === 0 || len_v > maxCheckpointLength) continue;

    const unit_v = v.copy().div(len_v);
    const inner = p5.Vector.add(innerPos, unit_v.mult(marginPx));
    const outer = p5.Vector.sub(hitOuter, unit_v.mult(marginPx));

    const cp = new Boundary(inner.x, inner.y, outer.x, outer.y);
    cp.isCheckpoint = true;
    checkpoints.push(cp);
  }

  // -----------------------------
  // 4) Loop + start/end - Dynamic overlap based on spacing
  // -----------------------------
  const overlapDistance = 700;  // Approx overlap px
  const overlapCount = Math.ceil(overlapDistance / checkpointSpacing);
  const overlap = checkpoints.slice(0, overlapCount);
  checkpoints = checkpoints.concat(overlap);

  start = checkpoints[0].midpoint();
  end = checkpoints[checkpoints.length - 1].midpoint();

  console.log("TRACK OK");
  console.log("Inner:", innerPoints.length,
              "Outer:", outerPoints.length,
              "Center:", smoothPath.length,
              "Checkpoints:", checkpoints.length);
}


function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  // Set canvas z-index below UI elements so sliders are clickable
  canvas.style('z-index', '-1');

  tf.setBackend('cpu');

  ensureToast();
  ensureTrainingControls();

  trackBuilder.toggle();
  // Controls how many simulation steps are executed per rendered frame.
  // Higher = faster training (at the cost of CPU usage).
  speedSlider = createSlider(1, 50, 1, 1);
  speedSlider.position(10, height - 90);
  speedSlider.style('width', '220px');
  speedSlider.style('z-index', '1000');
  speedSlider.hide();

  // Themed label for the speed slider
  speedSliderLabel = createDiv('Simulation speed');
  speedSliderLabel.style('color', '#ff69d2');
  speedSliderLabel.style('font-size', '12px');
  speedSliderLabel.style('font-family', 'sans-serif');
  speedSliderLabel.style('letter-spacing', '0.6px');
  speedSliderLabel.style('padding', '6px 10px');
  speedSliderLabel.style('border-radius', '10px');
  speedSliderLabel.style('background', 'rgba(255,105,210,0.08)');
  speedSliderLabel.style('border', '1px solid rgba(255,105,210,0.35)');
  speedSliderLabel.style('backdrop-filter', 'blur(6px)');
  speedSliderLabel.style('z-index', '1000');
  speedSliderLabel.hide();

  // Minimal TRAINING-only sliders requested
  // Position on RIGHT side to avoid overlap with centered control panel
  const w = 220;
  const margin = 14;
  const left = windowWidth - w - margin;
  const top = 80;  // Start below control panel (which may wrap to ~60-70px height)
  const labelStyle = (d) => {
    d.style('color', '#fff');
    d.style('font-size', '12px');
    d.style('font-family', 'sans-serif');
    d.style('z-index', '1001');  // Higher than panel (1000) to prevent overlap
  };
  const sliderStyle = (s) => {
    s.style('width', `${w}px`);
    s.style('z-index', '1001');  // Higher than panel (1000) to prevent overlap
    s.style('pointer-events', 'auto');
    s.style('cursor', 'pointer');
  };

  let y = top;
  const mk = (text, slider) => {
    const d = createDiv(text);
    d.position(left, y);
    labelStyle(d);
    trainingParamLabels.push(d);
    y += 16;
    slider.position(left, y);
    sliderStyle(slider);
    y += 28;
  };

  totalCarsSlider = createSlider(10, 300, TOTAL, 1);
  mk('CARS', totalCarsSlider);

  mutationRateSlider = createSlider(0, 0.5, MUTATION_RATE, 0.01);
  mk('MUTATION_RATE', mutationRateSlider);

  lifespanSlider = createSlider(50, 1000, LIFESPAN, 10);
  mk('LIFESPAN', lifespanSlider);

  maxSpeedSlider = createSlider(1, 12, MAXSPEED, 0.5);
  mk('maxspeed', maxSpeedSlider);

  maxForceSlider = createSlider(0.05, 1.0, MAXFORCE, 0.01);
  mk('maxforce', maxForceSlider);

  sightSlider = createSlider(20, 300, SIGHT, 5);
  mk('SIGHT', sightSlider);

  // When a TRAINING param changes, restart evolution from generation 0.
  // Use .changed() so it triggers once after you release the slider.
  const onParamChanged = () => {
    setTrainingParamsFromSliders();
    if (mode === 'TRAINING') {
      resetTrainingRun();
    }
  };

  // Also use .input() for immediate feedback while dragging
  const onParamInput = () => {
    setTrainingParamsFromSliders();
  };

  totalCarsSlider.changed(onParamChanged);
  totalCarsSlider.input(onParamInput);
  mutationRateSlider.changed(onParamChanged);
  mutationRateSlider.input(onParamInput);
  lifespanSlider.changed(onParamChanged);
  lifespanSlider.input(onParamInput);
  maxSpeedSlider.changed(onParamChanged);
  maxSpeedSlider.input(onParamInput);
  maxForceSlider.changed(onParamChanged);
  maxForceSlider.input(onParamInput);
  sightSlider.changed(onParamChanged);
  sightSlider.input(onParamInput);

  showTrainingParamUI(false);

  // Ensure UI is correctly positioned on first frame.
  positionUI();
}

function positionUI() {
  // Keep the speed slider anchored to the bottom-left.
  if (speedSlider) {
    speedSlider.position(10, height - 44);
  }
  if (speedSliderLabel) {
    speedSliderLabel.position(10, height - 76);
  }

  positionTrainingParamUI();
  positionTrainingControls();
  positionRaceControls();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  positionUI();
}

// ============================================
// Human Player & Camera Functions
// ============================================

function updateHumanControls() {
  const up = keyIsDown(UP_ARROW);
  const down = keyIsDown(DOWN_ARROW);
  const left = keyIsDown(LEFT_ARROW);
  const right = keyIsDown(RIGHT_ARROW);

  // Incremental speed control
  const accelRate = 0.02;   // Speed increase per frame
  const decelRate = 0.015;  // Speed decrease per frame
  const minSpeed = 0.0;     // Minimum speed (0% - full stop)
  const maxSpeed = 1.0;     // Maximum speed (100%)

  if (up && !down) {
    // Accelerate: gradually increase speed
    humanControls.speed = min(maxSpeed, humanControls.speed + accelRate);
    humanControls.accelerating = true;
    humanControls.braking = false;
  } else if (down && !up) {
    // Decelerate: gradually decrease speed
    humanControls.speed = max(minSpeed, humanControls.speed - decelRate);
    humanControls.accelerating = false;
    humanControls.braking = true;
  } else {
    // Coast: maintain current speed
    humanControls.accelerating = false;
    humanControls.braking = false;
  }

  // Update throttle to match current speed
  humanControls.throttle = humanControls.speed;

  // Discrete angle-based steering for better keyboard control
  // Based on p5.js racing game best practices
  const turnRate = 0.03;        // Radians to turn per frame when key is held (reduced)
  const maxSteerAngle = 0.25;   // Maximum steering angle (in radians, ~14 degrees)
  const returnRate = 0.02;      // How fast steering returns to center

  if (left && !right) {
    // Turn left: decrease angle
    humanControls.steeringAngle = max(-maxSteerAngle, humanControls.steeringAngle - turnRate);
    humanControls.turningLeft = true;
    humanControls.turningRight = false;
  } else if (right && !left) {
    // Turn right: increase angle
    humanControls.steeringAngle = min(maxSteerAngle, humanControls.steeringAngle + turnRate);
    humanControls.turningLeft = false;
    humanControls.turningRight = true;
  } else {
    // Auto-center when no keys pressed
    if (abs(humanControls.steeringAngle) < returnRate) {
      humanControls.steeringAngle = 0;
    } else if (humanControls.steeringAngle > 0) {
      humanControls.steeringAngle -= returnRate;
    } else {
      humanControls.steeringAngle += returnRate;
    }
    humanControls.turningLeft = false;
    humanControls.turningRight = false;
  }

  // Convert angle to 0-1 range for compatibility with vehicle system
  // Map -maxSteerAngle to maxSteerAngle -> 0 to 1
  humanControls.steering = map(humanControls.steeringAngle, -maxSteerAngle, maxSteerAngle, 0, 1);
}

function getHumanVehicle() {
  if (mode !== 'RACE') return null;
  return raceVehicles.find(v => v && v instanceof HumanVehicle) || null;
}

function applyCameraTransform() {
  if (!cameraState.enabled || !cameraState.target) return;

  const car = cameraState.target;

  // IMPORTANT: Camera ONLY follows human player in human vs robot mode
  // Do not apply camera if target is not a human vehicle
  if (!(car instanceof HumanVehicle)) return;

  // Safety check: don't apply transform if car is invalid or has no velocity
  if (!car || !car.vel || !car.pos) return;

  // Fixed camera: no rotation, zoomed in to show ~80-160 pixels around car
  // Base view radius (minimum visibility)
  let baseViewRadius = 80;
  
  // Calculate dynamic zoom based on speed
  const currentSpeed = (car.vel && typeof car.vel.mag === 'function') ? car.vel.mag() : 0;
  // Map speed from 0..MAXSPEED to 0..120 extra pixels of view radius.
  // We use MAXSPEED or a default of 5 for the mapping range.
  const topSpeed = (typeof MAXSPEED !== 'undefined') ? MAXSPEED : 5;
  const dynamicPadding = map(currentSpeed, 0, topSpeed, 0, 120); 
  
  const viewRadius = baseViewRadius + dynamicPadding;
  const zoomFactor = min(width, height) / (viewRadius * 2);

  translate(width / 2, height / 2);              // Center canvas
  scale(zoomFactor);                              // Zoom in to show limited area
  translate(-car.pos.x, -car.pos.y);            // Follow car position (no rotation)
}

function drawMinimap() {
  if (!cameraState.enabled || mode !== 'RACE') return;
  if (!walls || walls.length === 0) return;

  // Calculate track bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const wall of walls) {
    if (!wall || !wall.a || !wall.b) continue;
    minX = min(minX, wall.a.x, wall.b.x);
    minY = min(minY, wall.a.y, wall.b.y);
    maxX = max(maxX, wall.a.x, wall.b.x);
    maxY = max(maxY, wall.a.y, wall.b.y);
  }

  // Minimap dimensions and position
  const mapSize = 150;
  const mapX = 16;
  const mapY = height - mapSize - 16;
  const trackWidth = maxX - minX;
  const trackHeight = maxY - minY;
  const scale = (mapSize - 20) / max(trackWidth, trackHeight);

  push();

  // Background
  noStroke();
  fill(10, 10, 14, 220);
  rect(mapX, mapY, mapSize, mapSize, 12);

  // Border
  noFill();
  stroke(255, 105, 210, 100);
  strokeWeight(1.5);
  rect(mapX, mapY, mapSize, mapSize, 12);

  // Draw track walls
  stroke(255, 255, 255, 120);
  strokeWeight(1);
  for (const wall of walls) {
    if (!wall || !wall.a || !wall.b) continue;
    const x1 = mapX + 10 + (wall.a.x - minX) * scale;
    const y1 = mapY + 10 + (wall.a.y - minY) * scale;
    const x2 = mapX + 10 + (wall.b.x - minX) * scale;
    const y2 = mapY + 10 + (wall.b.y - minY) * scale;
    line(x1, y1, x2, y2);
  }

  // Draw racer positions
  for (const v of raceVehicles) {
    if (!v || !v.pos || v.dead) continue;

    const dotX = mapX + 10 + (v.pos.x - minX) * scale;
    const dotY = mapY + 10 + (v.pos.y - minY) * scale;

    // Different color/size for human player
    if (v instanceof HumanVehicle) {
      // Human player - larger, bright cyan
      fill(0, 255, 255);
      noStroke();
      circle(dotX, dotY, 8);
      // Outline
      noFill();
      stroke(255, 255, 255, 200);
      strokeWeight(1.5);
      circle(dotX, dotY, 8);
    } else {
      // AI racers - smaller, use their render color
      fill(v.renderColor || color(255, 105, 210));
      noStroke();
      circle(dotX, dotY, 4);
    }
  }

  pop();
}

function parseBrainNameList(raw) {
  if (!raw) return [];
  return raw
    .split(/[,\n]/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function pickBrainsFromUserInput(raw, availableBrains) {
  const tokens = parseBrainNameList(raw);
  if (!tokens.length) return [];

  const result = [];
  const add = (name) => {
    if (!name) return;
    if (!availableBrains.includes(name)) return;
    if (!result.includes(name)) result.push(name);
  };

  for (const t of tokens) {
    // Accept 1-based indices
    const idx = parseInt(t, 10);
    if (!Number.isNaN(idx) && String(idx) === t) {
      const name = availableBrains[idx - 1];
      add(name);
      continue;
    }
    // Accept exact names
    add(t);
  }

  return result;
}

function hashStringToInt(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function colorForBrainName(name, idx) {
  // Deterministic per-name color (avoid cyan/blue; stay in pink/purple range)
  const base = VFX_HUE_BASE;
  const h = hashStringToInt(name) % 1000;
  const hue = (base + 10 + (h % 80) + idx * 7) % 360;
  colorMode(HSB, 360, 100, 100, 255);
  const c = color(hue, 85, 100, 255);
  colorMode(RGB, 255);
  return c;
}

function gradientForBrainName(name, idx) {
  // Deterministic but random-looking per-name gradient.
  // Use a wide "cool" hue range so racers don't end up with similar colors.
  // Cool-ish hues: ~170..320 (teal/cyan/blue/purple/pink).
  const h = hashStringToInt(name);

  const coolMin = 170;
  const coolMax = 320;
  const coolSpan = coolMax - coolMin;

  // Two independent pseudo-random values from the hash.
  const r1 = (h % 100000) / 100000;
  const r2 = ((Math.imul(h, 1103515245) + 12345) >>> 0) / 4294967295;

  let hue1 = coolMin + (r1 * coolSpan);
  // Make hue2 meaningfully different from hue1
  let hue2 = coolMin + (r2 * coolSpan);
  if (Math.abs(hue2 - hue1) < 35) {
    hue2 = coolMin + ((hue2 - coolMin + 75) % coolSpan);
  }

  // Small index offset helps avoid near-collisions when names hash similarly
  hue1 = (hue1 + idx * 13) % 360;
  hue2 = (hue2 + idx * 17) % 360;

  colorMode(HSB, 360, 100, 100, 255);
  const a = color(hue1, 95, 100, 255);
  const b = color(hue2, 90, 100, 255);
  const mid = lerpColor(a, b, 0.55);
  colorMode(RGB, 255);

  return { a, b, mid };
}

function initRaceVehicles(names, includeHuman = false) {
  // Properly dispose old race vehicles before creating new ones
  if (raceVehicles && raceVehicles.length > 0) {
    for (const v of raceVehicles) {
      if (v && typeof v.dispose === 'function') {
        // Only dispose robot vehicles (they have brains to dispose)
        // Human vehicles have no brain, so dispose is a no-op
        if (v instanceof RobotVehicle) {
          v.dispose();
        }
      }
    }
  }

  raceBrainNames = names.slice();
  raceVehicles = [];
  resetBestCarVfx();
  resetRaceCarVfx();
  activeCheckpoint = null;
  lastCheckpointHit = null;

  // Reset camera - ONLY enable in human vs robot mode
  cameraState.enabled = false;
  cameraState.target = null;

  // Reset human controls
  humanControls.steering = 0.5;
  humanControls.throttle = 0.85;
  humanControls.steeringAngle = 0;
  humanControls.speed = 0.85;

  // Reset human race state
  if (includeHuman) {
    humanRaceState.isGameOver = false;
    humanRaceState.startTime = Date.now();
    humanRaceState.survivalTime = 0;
    humanRaceState.score = 0;
  }

  // Create human player first (if requested)
  if (includeHuman) {
    const humanVehicle = new HumanVehicle();
    humanVehicle.displayName = 'YOU';
    humanVehicle.ignoreLifespan = true;
    humanVehicle.isRace = true;
    humanVehicle.sight = 40;  // Fixed sight distance for human player

    // Distinct color for human (bright cyan/green)
    colorMode(HSB, 360, 100, 100, 255);
    const humanColorA = color(180, 100, 100, 255);  // Cyan
    const humanColorB = color(140, 100, 100, 255);  // Light cyan
    const humanMid = lerpColor(humanColorA, humanColorB, 0.5);
    colorMode(RGB, 255);

    humanVehicle.renderColorA = humanColorA;
    humanVehicle.renderColorB = humanColorB;
    humanVehicle.renderColor = humanMid;

    raceVehicles.push(humanVehicle);

    // Enable camera ONLY for human player
    cameraState.enabled = true;
    cameraState.target = humanVehicle;
  }

  for (let i = 0; i < raceBrainNames.length; i++) {
    const brainName = raceBrainNames[i];
    const brain = BrainStorage.loadBrain(brainName);
    if (!brain) continue;
    // Mark loaded (some storage versions don't set this)
    brain.isLoaded = true;
    const v = new RobotVehicle(brain);

    // Apply saved params (if present) to this racer instance
    if (brain.params) {
      if (typeof brain.params.maxspeed === 'number') v.maxspeed = brain.params.maxspeed;
      if (typeof brain.params.maxforce === 'number') v.maxforce = brain.params.maxforce;
      if (typeof brain.params.sight === 'number') v.sight = brain.params.sight;
    }

    v.displayName = brainName;

    const g = gradientForBrainName(brainName, i);
    v.renderColorA = g.a;
    v.renderColorB = g.b;
    // Keep a single representative color for existing VFX code.
    v.renderColor = g.mid;
    // In RACE, cars should only die on crash (not on time limit).
    v.ignoreLifespan = true;
    v.isRace = true;
    // Race should run forever; if a car dies, it will respawn.
    raceVehicles.push(v);
  }

  // ------------------------------------------------------------
  // Align all cars with the track direction immediately.
  // ------------------------------------------------------------
  let startDir = createVector(1, 0); // Default right
  if (checkpoints && checkpoints.length > 1) {
    // Direction from start (cp[0]) to next cp (cp[1])
    // Use midpoints to be safe
    const p1 = checkpoints[0].midpoint();
    const p2 = checkpoints[1].midpoint();
    startDir = p5.Vector.sub(p2, p1).normalize();
  }
  
  // Apply a tiny velocity in this direction so heading() works correctly
  // and manually rotate rays to match.
  for (const v of raceVehicles) {
    if (!v) continue;
    // Tiny speed so it doesn't visibly move but has a valid heading
    v.vel = startDir.copy().mult(0.001);
    
    // Force sensor update immediately
    if (v.rays && v.rays.length) {
      const angle = v.vel.heading();
      for (let r of v.rays) {
        if (r && typeof r.rotate === 'function') r.rotate(angle);
      }
    }
  }
}

function computeRaceScore(v, checkpoints) {
  if (!v) return -Infinity;
  const idx = (typeof v.index === 'number' ? v.index : 0);
  const progress = (typeof v.checkpointsPassed === 'number')
    ? v.checkpointsPassed
    : ((typeof v.fitness === 'number') ? v.fitness : idx);
  const totalDist = (typeof v.distanceTravelled === 'number') ? v.distanceTravelled : 0;
  let distToNext = Infinity;

  // Ensure we have a goal checkpoint reference.
  // In normal flow, v.check(checkpoints) sets v.goal.
  if ((!v.goal || !v.goal.a || !v.goal.b) && checkpoints && checkpoints.length) {
    const cp = checkpoints[idx % checkpoints.length];
    if (cp) v.goal = cp;
  }

  if (v.goal && v.goal.a && v.goal.b && typeof pldistance === 'function') {
    distToNext = pldistance(v.goal.a, v.goal.b, v.pos.x, v.pos.y);
  }

  // Ranking: use cumulative distance traveled so it never resets.
  // Keep progress as an informational field in the UI.
  const score = totalDist;
  return { score, distToNext, progress, idx, totalDist };
}

function getRaceRanking(raceVehicles, checkpoints) {
  const rows = [];
  for (const v of (raceVehicles || [])) {
    if (!v) continue;
    const name = v.displayName || 'Racer';
    const r = computeRaceScore(v, checkpoints);
    rows.push({
      v,
      name,
      idx: r.idx,
      progress: r.progress,
      score: r.score,
      distToNext: r.distToNext,
      totalDist: r.totalDist,
      dead: !!v.dead,
      finished: !!v.finished,
    });
  }
  // IMPORTANT: crashed cars should never be "ahead" of alive racers.
  // Sort by state first, then by score.
  // stateRank: 0 = alive, 1 = finished, 2 = dead
  rows.sort((a, b) => {
    const sa = a.dead ? 2 : (a.finished ? 1 : 0);
    const sb = b.dead ? 2 : (b.finished ? 1 : 0);
    if (sa !== sb) return sa - sb;
    return b.score - a.score;
  });
  return rows;
}

function isInteractingWithUI(event) {
  if (Date.now() < uiBlockMouseUntil) return true;
  if (uiModalActive) return true;
  if (!event || !event.target) return false;
  if (uiModalBackdrop && uiModalBackdrop.elt && uiModalBackdrop.elt.contains(event.target)) return true;
  const targets = [];
  if (trainingControlsPanel) targets.push(trainingControlsPanel.elt);
  if (btnTrainSave) targets.push(btnTrainSave.elt);
  if (btnTrainLoad) targets.push(btnTrainLoad.elt);
  if (btnTrainDelete) targets.push(btnTrainDelete.elt);
  if (btnTrainRace) targets.push(btnTrainRace.elt);
  if (btnTrainNewTrack) targets.push(btnTrainNewTrack.elt);
  if (raceControlsPanel) targets.push(raceControlsPanel.elt);
  if (btnRacePick) targets.push(btnRacePick.elt);
  if (btnRaceBack) targets.push(btnRaceBack.elt);
  if (speedSlider) targets.push(speedSlider.elt);
  if (speedSliderLabel) targets.push(speedSliderLabel.elt);
  if (mutationRateSlider) targets.push(mutationRateSlider.elt);
  if (lifespanSlider) targets.push(lifespanSlider.elt);
  if (maxSpeedSlider) targets.push(maxSpeedSlider.elt);
  if (maxForceSlider) targets.push(maxForceSlider.elt);
  if (sightSlider) targets.push(sightSlider.elt);
  if (totalCarsSlider) targets.push(totalCarsSlider.elt);
  return targets.includes(event.target);
}

function draw() {
  background(0);

  // Update human controls if in RACE mode with human player
  if (mode === 'RACE' && getHumanVehicle()) {
    if (!humanRaceState.isGameOver) {
      updateHumanControls();

      // Update survival time and score
      humanRaceState.survivalTime = (Date.now() - humanRaceState.startTime) / 1000;
      const humanVehicle = getHumanVehicle();
      if (humanVehicle) {
        // Score = distance traveled + time bonus
        humanRaceState.score = Math.round(humanVehicle.distanceTravelled + humanRaceState.survivalTime * 10);
      }
    }
  }

  // Show the sliders only in the relevant modes.
  if (speedSlider) {
    if (mode === "TRAINING" || mode === "RACE") {
      speedSlider.show();
      if (speedSliderLabel) speedSliderLabel.show();
    } else {
      speedSlider.hide();
      if (speedSliderLabel) speedSliderLabel.hide();
    }
  }
  showTrainingParamUI(mode === 'TRAINING');
  showTrainingControls(mode === 'TRAINING');
  showRaceControls(mode === 'RACE');

  // Always keep globals in sync with slider values in TRAINING.
  if (mode === 'TRAINING') {
    setTrainingParamsFromSliders();
  }

  // STEP 1: BUILDING POINTS (no track yet)
  if (mode === "BUILDING") {
    trackBuilder.show();
    fill(255);
    textSize(14);
    text("Click to add points • Right-click undo • ENTER to adjust points", 10, height - 20);
    return;
  }

  // STEP 2: ADJUSTING POINTS (before track is created)
  if (mode === "ADJUSTING") {
    push();
    
    // Draw grid
    stroke(40);
    strokeWeight(1);
    for (let x = 0; x < width; x += 50) {
      line(x, 0, x, height);
    }
    for (let y = 0; y < height; y += 50) {
      line(0, y, width, y);
    }

    // Draw track preview with points
    if (trackBuilder.points.length > 0) {
      // Draw segments
      stroke(100, 200, 100);
      strokeWeight(3);
      for (let i = 0; i < trackBuilder.points.length; i++) {
        let p1 = trackBuilder.points[i];
        let p2 = trackBuilder.points[(i + 1) % trackBuilder.points.length];
        line(p1.x, p1.y, p2.x, p2.y);
      }

      // Draw points (draggable)
      for (let i = 0; i < trackBuilder.points.length; i++) {
        let p = trackBuilder.points[i];
        let isHovered = dist(mouseX, mouseY, p.x, p.y) < 15;

        fill(isHovered ? 255 : 100, 255, 100);
        noStroke();
        circle(p.x, p.y, isHovered ? 16 : 12);

        fill(0);
        textSize(10);
        textAlign(CENTER, CENTER);
        text(i, p.x, p.y);
      }

      // Draw width preview
      if (trackBuilder.points.length > 2) {
        stroke(200, 100, 100, 80);
        strokeWeight(1);
        
        for (let i = 0; i < trackBuilder.points.length; i++) {
          let p1 = trackBuilder.points[i];
          let p2 = trackBuilder.points[(i + 1) % trackBuilder.points.length];
          
          let dir = p5.Vector.sub(p2, p1);
          dir.normalize();
          let perp = createVector(-dir.y, dir.x);
          
          let inner1 = p5.Vector.add(p1, p5.Vector.mult(perp, trackBuilder.pathWidth));
          let inner2 = p5.Vector.add(p2, p5.Vector.mult(perp, trackBuilder.pathWidth));
          let outer1 = p5.Vector.sub(p1, p5.Vector.mult(perp, trackBuilder.pathWidth));
          let outer2 = p5.Vector.sub(p2, p5.Vector.mult(perp, trackBuilder.pathWidth));
          
          line(inner1.x, inner1.y, inner2.x, inner2.y);
          line(outer1.x, outer1.y, outer2.x, outer2.y);
        }
      }
    }

    // UI Panel (neon/glass)
    fill(10, 10, 14, 200);
    stroke(255, 105, 210, 170);
    strokeWeight(2);
    rect(10, 10, 320, 130, 12);

    fill(255, 105, 210);
    textSize(16);
    textAlign(LEFT);
    text("ADJUST POINTS", 20, 35);

    fill(200);
    textSize(12);
    text(`Points: ${trackBuilder.points.length}`, 20, 60);
    text(`Width: ${trackBuilder.pathWidth}px`, 20, 80);
    text("Drag point: move • Drag empty: width", 20, 100);

    pop();

    fill(255);
    textSize(14);
    text("Drag points to adjust • Drag empty to change width • ENTER to create track", 10, height - 20);
    return;
  }

  // STEP 3: EDITING (track created, can still adjust obstacles)
  if (mode === "EDITING") {
    drawStyledTrack();
    drawStyledWalls();
    for (let cp of checkpoints) cp.showCheckpoint();
    showObstacles();
    
    fill(10, 10, 14, 200);
    stroke(255, 105, 210, 170);
    strokeWeight(2);
    rect(10, 10, 320, 90, 12);
    fill(255, 105, 210);
    textSize(14);
    text("TRACK CREATED", 20, 35);
    fill(200);
    textSize(12);
    text("'E' = Add Obstacles", 20, 60);
    text("ENTER = Start Training", 20, 80);
    
    fill(255);
    textSize(14);
    text("Track ready! Press 'E' for obstacles or ENTER to train", 10, height - 20);
    return;
  }

  // STEP 4: ADDING OBSTACLES
  if (mode === "OBSTACLES") {
    drawStyledTrack();
    drawStyledWalls();
    for (let cp of checkpoints) cp.showCheckpoint();
    showObstacles();
    obstacleEditor.showDraggingPreview();
    
    fill(255);
    textSize(24);
    noStroke();
    text('OBSTACLE EDITOR', 10, 50);
    
    obstacleEditor.show();
    
    fill(200);
    textSize(12);
    text("Click shape • Drag to place • Right-click to remove • ENTER to train", 10, height - 20);
    return;
  }

  // STEP 5: TRAINING
  if (mode === "TRAINING") {
    if (population.length === 0) {
      resetBestCarVfx();
      activeCheckpoint = null;
      lastCheckpointHit = null;
      for (let i = 0; i < TOTAL; i++) {
        if (selectedBrainName && i === 0) {
          let loadedBrain = BrainStorage.loadBrain(selectedBrainName);
          if (loadedBrain) {
            loadedBrain.isLoaded = true;
            if (loadedBrain.params) {
              applySavedParamsToGlobalsAndSliders(loadedBrain.params);
              setTrainingParamsFromSliders();
            }
            population[i] = new RobotVehicle(loadedBrain);
          } else {
            population[i] = new RobotVehicle();
          }
        } else {
          population[i] = new RobotVehicle();
        }
      }
    }

    // Apply current physics params to existing vehicles so changes take effect immediately.
    applyParamsToVehicles(population);
    applyParamsToVehicles(savedVehicles);

    const cycles = speedSlider.value();
    let bestP = population[0];

    for (let n = 0; n < cycles; n++) {
      for (let vehicle of population) {
        vehicle.applyBehaviors(walls, population);
        const crossed = vehicle.check(checkpoints);
        vehicle.update();
        if (vehicle.fitness > bestP.fitness) {
          bestP = vehicle;
        }

        // Visual-only: flash checkpoints only for the currently highlighted/best car.
        if (crossed && bestP === vehicle && typeof crossed.markHit === 'function') {
          // Keep only one checkpoint visible: clear the previous active one.
          if (activeCheckpoint && activeCheckpoint !== crossed) {
            if (typeof activeCheckpoint.lastHitFrame !== 'undefined') {
              activeCheckpoint.lastHitFrame = -1;
            }
          }
          activeCheckpoint = crossed;
          crossed.markHit();

          // Visual-only: mark hit position at the car (front)
          setLastCheckpointHitFromCar(bestP, crossed);
        }
      }

      for (let i = population.length - 1; i >= 0; i--) {
        const vehicle = population[i];
        if (vehicle.dead || vehicle.finished) {
          savedVehicles.push(population.splice(i, 1)[0]);
        }
      }

      if (population.length == 0) {
        nextGeneration();
        generationCount++;
        resetBestCarVfx();
        activeCheckpoint = null;
      }
    }

    drawStyledTrack();
    drawStyledWalls();

    showObstacles();

    // Trail goes behind cars for readability.
    updateBestCarTrail(bestP);
    spawnBestCarParticles(bestP);
    updateBestCarParticles();
    drawBestCarTrail();
    drawBestCarParticles();

    for (let vehicle of population) {
      vehicle.show();
    }

    if (bestP) {
      bestP.highlight();
    }

    // In TRAINING, draw the flash on the car so it doesn't appear behind
    // when multiple simulation cycles are executed per frame.
    drawCheckpointHitMarker(bestP);

    // Top-left header
    push();
    noStroke();
    fill(255, 105, 210);
    textSize(20);
    text('TRAINING MODE', 10, 30);
    fill(235);
    textSize(16);
    text('generation ' + generationCount, 10, 52);

    // Display cars alive / total
    const carsAlive = population.length;
    const carsTotal = TOTAL;
    const sliderVal = totalCarsSlider ? totalCarsSlider.value() : TOTAL;
    fill(carsAlive > 0 ? color(100, 255, 100) : color(255, 100, 100));
    text(`cars: ${carsAlive} / ${carsTotal} (slider: ${sliderVal})`, 10, 72);
    pop();

    displayControls();
  }

  // STEP 6: RACE (loaded brains only, infinite)
  if (mode === "RACE") {
    if (!raceVehicles || raceVehicles.length === 0) {
      // If we entered race mode without initializing, fall back to TRAINING.
      mode = "TRAINING";
      return;
    }

    const cycles = speedSlider ? speedSlider.value() : 1;

    for (let n = 0; n < cycles; n++) {
      for (const v of raceVehicles) {
        // In RACE: no respawn. If a car crashes, it stays where it crashed.
        // Other cars continue running.
        if (!v || v.dead || v.finished) {
          // Check if human player died
          if (v instanceof HumanVehicle && v.dead && !humanRaceState.isGameOver) {
            humanRaceState.isGameOver = true;
          }
          continue;
        }

        // Link human controls to human vehicle
        if (v instanceof HumanVehicle) {
          v.humanControls = humanControls;
          // Stop updating if game over
          if (humanRaceState.isGameOver) continue;
        }

        v.applyBehaviors(walls, raceVehicles);
        v.check(checkpoints);
        v.update();
      }
    }

    // === WORLD RENDERING (with camera for human player) ===
    push();
    // Camera ONLY in human vs robot mode, following human player
    const humanVehicle = getHumanVehicle();
    if (cameraState.enabled && humanVehicle && !humanRaceState.isGameOver) {
      applyCameraTransform();
    }

    drawStyledTrack();
    drawStyledWalls();
    showObstacles();

    // RACE VFX: every car has its own trail + particles (visual-only)
    // Draw behind cars for readability.
    for (const v of raceVehicles) {
      if (!v || v.dead) continue;
      updateRaceCarTrail(v);
      spawnRaceCarParticles(v);
      updateRaceCarParticles(v);
      drawRaceCarTrail(v);
      drawRaceCarParticles(v);
    }

    for (const v of raceVehicles) {
      // Match the "normal" look: bigger body, but NO rays in RACE
      if (v && !v.dead && typeof v.highlight === 'function') v.highlight(false);
      else if (v && typeof v.showLarge === 'function') v.showLarge();
      else if (v) v.show();
    }

    pop();
    // === END WORLD RENDERING ===

    // === UI RENDERING (not affected by camera - stays on screen) ===
    // Minimap showing track and racer positions
    drawMinimap();

    // Live ranking overlay (updates automatically when racers overtake)
    const ranking = getRaceRanking(raceVehicles, checkpoints);
    push();
    colorMode(RGB, 255);
    textAlign(LEFT, TOP);
    noStroke();
    fill(235);
    textSize(13);
    const x0 = 10;
    let y0 = 100;
    text('RANKING', x0, y0);
    y0 += 18;
    textSize(12);
    const lineH = 16;
    for (let i = 0; i < ranking.length; i++) {
      const r = ranking[i];
      const col = r.v && r.v.renderColor ? r.v.renderColor : color(200);

      // Gradient swatch matching the car
      const swX = x0;
      const swY = y0 + i * lineH + 3;
      const swW = 22;
      const swH = 9;
      noStroke();
      if (r.v && r.v.renderColorA && r.v.renderColorB) {
        const steps = 8;
        for (let s = 0; s < steps; s++) {
          const t = steps === 1 ? 0 : s / (steps - 1);
          const c = lerpColor(r.v.renderColorA, r.v.renderColorB, t);
          fill(red(c), green(c), blue(c), 220);
          rect(swX + s * (swW / steps), swY, swW / steps + 0.6, swH);
        }
      } else {
        fill(red(col), green(col), blue(col), 220);
        rect(swX, swY, swW, swH);
      }

      // Text in the mid color
      fill(red(col), green(col), blue(col), 255);
      const name = String(r.name).length > 18 ? String(r.name).slice(0, 18) + '…' : String(r.name);
      const d = Math.round(r.totalDist || 0);
      const status = r.dead ? ' CRASH' : (r.finished ? ' FIN' : '');
      text(`#${i + 1} ${name}  dist:${d}${status}`, x0 + swW + 6, y0 + i * lineH);
    }
    pop();

    // Top-left header (match TRAINING colors)
    push();
    noStroke();
    fill(255, 105, 210);
    textSize(20);
    text('RACE MODE', 10, 30);
    fill(235);
    textSize(12);
    if (speedSlider) text(`speed ${speedSlider.value()}x`, 10, 50);

    // Display number of racers
    const racersAlive = raceVehicles.filter(v => v && !v.dead && !v.finished).length;
    const racersTotal = raceVehicles.length;
    const racersCrashed = raceVehicles.filter(v => v && v.dead).length;
    fill(racersAlive > 0 ? color(100, 255, 100) : color(255, 100, 100));
    text(`racers: ${racersAlive} alive / ${racersCrashed} crashed / ${racersTotal} total`, 10, 65);
    pop();

    // Human controls indicator (bottom-right corner)
    if (getHumanVehicle() && !humanRaceState.isGameOver) {
      push();
      const x = width - 150;
      const y = height - 120;

      noStroke();
      fill(10, 10, 14, 200);
      rect(x, y, 140, 115, 12);

      fill(255, 105, 210);
      textSize(12);
      textAlign(LEFT);
      text('HUMAN CONTROLS', x + 10, y + 20);

      fill(200);
      textSize(10);
      text(humanControls.accelerating ? '↑ ACCEL' : '↑ ---', x + 10, y + 40);
      text(humanControls.braking ? '↓ BRAKE' : '↓ ---', x + 10, y + 55);
      text(humanControls.turningLeft ? '← LEFT' : '← ---', x + 10, y + 70);
      text(humanControls.turningRight ? '→ RIGHT' : '→ ---', x + 10, y + 85);

      // Speed indicator
      fill(100, 255, 100);
      const speedPercent = Math.round(humanControls.speed * 100);
      text(`Speed: ${speedPercent}%`, x + 10, y + 100);
      pop();

      // Show score during race
      push();
      fill(255, 255, 255);
      textSize(16);
      textAlign(CENTER);
      text(`Score: ${humanRaceState.score}`, width / 2, 80);
      text(`Time: ${humanRaceState.survivalTime.toFixed(1)}s`, width / 2, 100);
      pop();
    }

    // Game Over screen
    if (getHumanVehicle() && humanRaceState.isGameOver) {
      push();
      // Semi-transparent overlay
      fill(0, 0, 0, 180);
      rect(0, 0, width, height);

      // Game Over box
      fill(10, 10, 14, 240);
      stroke(255, 105, 210);
      strokeWeight(3);
      rectMode(CENTER);
      rect(width / 2, height / 2, 400, 300, 16);

      // Game Over text
      noStroke();
      fill(255, 105, 210);
      textSize(48);
      textAlign(CENTER);
      text('GAME OVER', width / 2, height / 2 - 80);

      // Score
      fill(255, 255, 255);
      textSize(24);
      text(`Final Score: ${humanRaceState.score}`, width / 2, height / 2 - 20);
      text(`Survival Time: ${humanRaceState.survivalTime.toFixed(1)}s`, width / 2, height / 2 + 15);

      const humanVehicle = getHumanVehicle();
      if (humanVehicle) {
        text(`Distance: ${Math.round(humanVehicle.distanceTravelled)}`, width / 2, height / 2 + 50);
      }

      // Restart instructions
      fill(200);
      textSize(18);
      text('Press R to Restart', width / 2, height / 2 + 100);
      text('Press ESC to Exit', width / 2, height / 2 + 130);

      pop();
    }
  }
}

function displayControls() {
  push();
  fill(200);
  textSize(12);
  noStroke();
  // Top-left lightweight status (controls are buttons now)
  // Top-left lightweight status (controls are buttons now)
  let yPos = 100;
  if (speedSlider) {
    text(`Speed: ${speedSlider.value()}x`, 10, yPos);
    yPos += 18;
  }

  if (selectedBrainName) {
    fill(255, 105, 210);
    text("Loaded: " + selectedBrainName, 10, yPos);
  }

  pop();
}

function mousePressed(event) {
  if (isInteractingWithUI(event)) return;
  if (mouseButton === RIGHT && mode === "BUILDING") {
    trackBuilder.undoPoint();
    return false;
  }

  if (mouseButton === RIGHT && mode === "OBSTACLES") {
    if (obstacleEditor && typeof obstacleEditor.tryRemoveAt === 'function') {
      const removed = obstacleEditor.tryRemoveAt(mouseX, mouseY);
      if (removed) showToast('Obstacle removed');
    }
    return false;
  }

  if (mode === "BUILDING") {
    trackBuilder.addPoint(mouseX, mouseY);
    return false;
  }

  if (mode === "ADJUSTING") {
    trackBuilder.startDrag(mouseX, mouseY);
    return false;
  }

  if (mode === "OBSTACLES") {
    // Click on a shape in the top-left panel
    for (let i = 0; i < obstacleEditor.shapes.length; i++) {
      let y = 55 + i * 30;
      if (mouseX > 20 && mouseX < 190 && mouseY > y && mouseY < y + 24) {
        obstacleEditor.selectShape(i);
        return false;
      }
    }
    obstacleEditor.startDrag(mouseX, mouseY);
    return false;
  }

  return false;
}

function mouseDragged(event) {
  if (isInteractingWithUI(event)) return;
  if (mode === "ADJUSTING") {
    trackBuilder.drag(mouseX, mouseY);
  }
  if (mode === "OBSTACLES") {
    obstacleEditor.drag(mouseX, mouseY);
  }
  return false;
}

function mouseReleased(event) {
  if (isInteractingWithUI(event)) return;
  trackBuilder.endDrag();
  if (mode === "OBSTACLES") {
    obstacleEditor.endDrag();
  }
  return false;
}

function wheel(event) {
  // Width adjustment is handled by drag in ADJUSTING.
  if (mode === "ADJUSTING") return false;
}

function keyPressed() {
  // When a modal is open, don't let the simulation consume keys.
  // But DO allow typing inside modal inputs.
  if (uiModalActive) {
    const el = (typeof document !== 'undefined') ? document.activeElement : null;
    const tag = el && el.tagName ? String(el.tagName).toUpperCase() : '';
    const isTyping = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');

    // If user is typing in an input, don't block the keystroke.
    if (isTyping) {
      return true;
    }

    // For info popups (like the obstacles instructions), allow ENTER/Esc to close.
    if (keyCode === ENTER || keyCode === ESCAPE) {
      closeModal();
      return false;
    }

    return false;
  }

  // RACE mode: Handle restart when human player in game over
  if (mode === 'RACE' && getHumanVehicle() && humanRaceState.isGameOver) {
    if (key === 'r' || key === 'R') {
      // Restart the race
      const brainNames = raceBrainNames.slice(); // Keep same opponents
      initRaceVehicles(brainNames, true); // true = include human
      return false;
    }
    if (keyCode === ESCAPE) {
      // Exit to training mode
      mode = 'TRAINING';
      return false;
    }
  }

  // BUILDING: Click points, ENTER to move to ADJUSTING
  if (mode === "BUILDING") {
    if (keyCode === ENTER) {
      if (trackBuilder.points.length >= 4) {
        mode = "ADJUSTING";
      } else {
        showToast('Need at least 4 points');
      }
      return false;
    }
    if (keyCode === DELETE) {
      trackBuilder.undoPoint();
      return false;
    }
    return false;
  }

  // ADJUSTING: Drag points, ENTER to create track
  if (mode === "ADJUSTING") {
    if (keyCode === ENTER) {
      if (trackBuilder.finalizeTrack(buildTrackFromPoints)) {
        // Immediately open obstacle placement after creating the track.
        mode = "OBSTACLES";
        if (obstacleEditor) {
          if (!obstacleEditor.isActive && typeof obstacleEditor.toggle === 'function') {
            obstacleEditor.toggle();
          }
        }
        showModal({
          title: 'Obstacles',
          message: 'Pick a shape in the top-left panel, then click to place obstacles. Right-click an obstacle to remove it. Press ENTER when you are ready to train.',
          kind: 'info',
          okText: 'OK',
        });
      }
      return false;
    }
    return false;
  }

  // EDITING: Add obstacles or train
  if (mode === "EDITING") {
    if (key === 'e' || key === 'E') {
      mode = "OBSTACLES";
      obstacleEditor.toggle();
      return false;
    }
    if (keyCode === ENTER) {
      mode = "TRAINING";
      return false;
    }
    return false;
  }

  // OBSTACLES: Add obstacles, ENTER to train
  if (mode === "OBSTACLES") {
    if (key === 'e' || key === 'E') {
      obstacleEditor.toggle();
      if (!obstacleEditor.isActive) {
        mode = "TRAINING";
      }
      return false;
    }
    if (keyCode === ENTER) {
      mode = "TRAINING";
      return false;
    }
    return false;
  }

  // TRAINING: Control keys
  if (mode === "TRAINING") {
    if (key === 't' || key === 'T') {
      doTrainingNewTrack();
      return false;
    }

    if (key === 's' || key === 'S') {
      doTrainingSave();
      return false;
    }

    if (key === 'l' || key === 'L') {
      doTrainingLoad();
      return false;
    }

    if (key === 'r' || key === 'R') {
      doTrainingRace();
      return false;
    }

    if (key === 'd' || key === 'D') {
      doTrainingDelete();
      return false;
    }
  }

  // RACE: Control keys
  if (mode === 'RACE') {
    if (key === 'g' || key === 'G') {
      // Return to training without resetting the track.
      population = [];
      savedVehicles = [];
      generationCount = 0;
      mode = 'TRAINING';
      return false;
    }

    if (key === 'r' || key === 'R') {
      const brains = BrainStorage.listAllBrains();
      if (!brains || brains.length === 0) {
        showToast('No saved brains');
        return false;
      }
      const currently = (raceVehicles || []).map(v => (v && (v.displayName || v.brainName))).filter(Boolean);
      showModalMultiSelect({
        title: 'Change racers',
        message: 'Choose racers:',
        options: brains,
        selected: currently,
        okText: 'Apply',
        cancelText: 'Cancel',
        onOk: (chosen) => {
          if (!chosen || chosen.length === 0) {
            showToast('Pick at least one racer');
            return;
          }
          initRaceVehicles(chosen);
        },
      });
      return false;
    }
  }
}