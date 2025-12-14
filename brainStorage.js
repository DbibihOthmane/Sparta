// Gestion du stockage des cerveaux (neural networks) dans localStorage

class BrainStorage {
  // Sauvegarde le cerveau du meilleur véhicule
  static saveBestBrain(vehicle, name = null, params = null) {
  if (!vehicle || !vehicle.brain) {
    console.error("Pas de véhicule avec un cerveau valide");
    return false;
  }

  const timestamp = new Date().toLocaleString();
  const brainName = name || `champion_gen${generationCount}_${timestamp}`;

  // Récupère les poids du réseau de neurones
  const weights = vehicle.brain.model.getWeights();
  const weightsData = [];

  // Convertit chaque tenseur en données JSON sérialisables
  tf.tidy(() => {
    for (let i = 0; i < weights.length; i++) {
      const data = weights[i].dataSync();
      const shape = weights[i].shape;
      weightsData.push({
        shape: shape,
        data: Array.from(data)
      });
    }
  });

  // Crée l'objet brain à sauvegarder
  const brainData = {
    name: brainName,
    generationCreated: generationCount,
    fitness: vehicle.fitness,
    timestamp: timestamp,
    inputNodes: vehicle.brain.input_nodes,
    hiddenNodes: vehicle.brain.hidden_nodes,
    outputNodes: vehicle.brain.output_nodes,
    weights: weightsData,
    // Save training/physics params used when this brain was saved
    params: params || {
      mutationRate: (typeof MUTATION_RATE !== 'undefined') ? MUTATION_RATE : 0.1,
      lifespan: (typeof LIFESPAN !== 'undefined') ? LIFESPAN : 25,
      maxspeed: (typeof MAXSPEED !== 'undefined') ? MAXSPEED : 5,
      maxforce: (typeof MAXFORCE !== 'undefined') ? MAXFORCE : 0.2,
      sight: (typeof SIGHT !== 'undefined') ? SIGHT : 50,
    },
    isLoaded: false  // Marque que c'est une version sauvegardée fraîche
  };

  // Récupère la liste existante des cerveaux sauvegardés
  let savedBrains = JSON.parse(localStorage.getItem('savedBrains') || '{}');

  // Ajoute le nouveau cerveau
  savedBrains[brainName] = brainData;

  // Sauvegarde dans localStorage
  try {
    localStorage.setItem('savedBrains', JSON.stringify(savedBrains));
    console.log(`Cerveau sauvegardé: ${brainName}`);
    return true;
  } catch (e) {
    console.error("Erreur lors de la sauvegarde:", e);
    return false;
  }
}

  // Charge un cerveau sauvegardé
  static loadBrain(brainName) {
  let savedBrains = JSON.parse(localStorage.getItem('savedBrains') || '{}');

  if (!savedBrains[brainName]) {
    console.error(`Cerveau non trouvé: ${brainName}`);
    return null;
  }

  const brainData = savedBrains[brainName];

  try {
    // Crée un nouveau modèle avec les paramètres stockés
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          units: brainData.hiddenNodes,
          inputShape: [brainData.inputNodes],
          activation: 'sigmoid'
        }),
        tf.layers.dense({
          units: brainData.outputNodes,
          activation: 'sigmoid'
        })
      ]
    });

    // Reconstitue les tenseurs à partir des données stockées
    const weights = [];
    for (let i = 0; i < brainData.weights.length; i++) {
      const wData = brainData.weights[i];
      const tensor = tf.tensor(wData.data, wData.shape);
      weights.push(tensor);
    }

    // Applique les poids au modèle
    model.setWeights(weights);

    // Crée et retourne le réseau de neurones
    const loadedBrain = new NeuralNetwork(
      model,
      brainData.inputNodes,
      brainData.hiddenNodes,
      brainData.outputNodes
    );

    // Marque le cerveau comme chargé
    loadedBrain.isLoaded = true;

    // Attach saved params (used by TRAINING sliders + RACE per-brain settings)
    loadedBrain.params = brainData.params || null;

    console.log(`Cerveau chargé: ${brainName}`);
    return loadedBrain;
  } catch (e) {
    console.error("Erreur lors du chargement:", e);
    return null;
  }
}

  // Liste tous les cerveaux sauvegardés
  static listAllBrains() {
    let savedBrains = JSON.parse(localStorage.getItem('savedBrains') || '{}');
    return Object.keys(savedBrains);
  }

  // Supprime un cerveau sauvegardé
  static deleteBrain(brainName) {
    let savedBrains = JSON.parse(localStorage.getItem('savedBrains') || '{}');

    if (savedBrains[brainName]) {
      delete savedBrains[brainName];
      localStorage.setItem('savedBrains', JSON.stringify(savedBrains));
      console.log(`Cerveau supprimé: ${brainName}`);
      return true;
    }
    return false;
  }

  // Récupère les informations d'un cerveau sauvegardé
  static getBrainInfo(brainName) {
    let savedBrains = JSON.parse(localStorage.getItem('savedBrains') || '{}');
    return savedBrains[brainName] || null;
  }

  // Exporte tous les cerveaux en JSON (pour télécharger)
  static exportAllBrains() {
    let savedBrains = JSON.parse(localStorage.getItem('savedBrains') || '{}');
    return JSON.stringify(savedBrains, null, 2);
  }

  // Importe des cerveaux depuis un JSON
  static importBrains(jsonData) {
    try {
      const newBrains = JSON.parse(jsonData);
      let savedBrains = JSON.parse(localStorage.getItem('savedBrains') || '{}');

      Object.assign(savedBrains, newBrains);
      localStorage.setItem('savedBrains', JSON.stringify(savedBrains));
      console.log("Cerveaux importés avec succès");
      return true;
    } catch (e) {
      console.error("Erreur lors de l'import:", e);
      return false;
    }
  }
}