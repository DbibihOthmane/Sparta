# Description de projet : Sparta-car

## **_Très important_** :

Veuillez regardez la vidéo démo afin de bien comprendre le fonctionnement de l'application :)

## Resumé :

L'application consiste a créer un circuit avec des points manuellement, ensuite ajouter des obstacles pour rendre le circuit plus difficile.
L'utilisateur peut lancer des simulations et peut jouer avec les paramètres pour avoir des meilleurs résultats, et peut ensuite enregister le model entrainé afin de le télécharger après pour des courses.

### MUTATION_RATE :

Le taux de mutation décide à quelle fréquence le cerveau de l’IA change un peu quand on crée une nouvelle voiture.
En d'autres termes, une voiture enfant copie le cerveau de la voiture parent, puis elle ajoute des modifications aléatoires.
Si le "Mutation Rate" est faible alors les modifications seront légères, au contraire si on l'augmente elles seront plus significatives et permettant plus d’exploration et comportements très différents.

### LIFESPAN :

Le LIFESPAN détermine combien de temps une voiture peut survivre sans avancer.
C'est à dire : si une voiture n'avance pas et ne passe aucun checkpoint pendant trop longtemps, elle sera éliminée !
LIFESPAN faible -> élimine vite les voitures bloquées et donne des générations plus rapides, mais ça risque de tuer des
voitures prometteuses trop tôt.
LIFESPAN élevé -> Laisse plus de temps pour explorer mais les générations sont plus longues.

### MAXSPEED :

MAXSPEED définit la vitesse maximale qu’une voiture peut atteindre.
Vitesse élevée -> les voitures vont plus vite et parcourent la piste plus rapidement, mais elles auront du mal à traverses les virages difficiles.
Vitesse faible -> Mouvement plus lent et précis, facile d'éviter les obstacles, mais la progression sera lente, et les générations seront plus longues.

### MAXFORCE :

MAXFORCE détermine à quelle vitesse une voiture peut changer de direction. C'est la force de braquage de la voiture ou son agilité.
MAXFORCE élevé -> Voitures très agiles, qui traverssent les virages sérrés rapidement et évitent mieux les murs,
mais la conduite sera instable et des mauvais mouvements.
MAXFORCE faible -> Voitures moins agiles, lents et doux. La conduite sera fluide et réaliste, mais la réaction est trop tard, et la voiture
va foncer souvent dans les murs !

### SIGHT :

SIGHT définit jusqu’à quelle distance la voiture peut voir les murs ou obstacles grâce à ses rayons. C'est la porteé de vision de la voiture.
SIGHT élevé -> La voiture voit loin devant, elle réagit plus tôt, meilleure planification sur pistes ouvertes, mais
elle n'arrivera pas à réagire trop tôt dnas les virages serrés
SIGHT faible -> La voiture voit seulement ce qui est proche, ses réactions sont tardives mais les calculs sont plus rapide
et peut résulter à une meilleur conduite !

## Mode Course (Race Cars) :

En plus de l'entrainement, vous pouvez lancer un mode course pour voir vos meilleurs modèles s'affronter, ou même piloter vous-même **(Human vs AI)** !
Ce mode intègre une caméra dynamique et une physique plus stable pour la course.

### Fonctionnalités Clés du Mode Course :

1.  **Human vs AI** : Prenez le contrôle d'une voiture (avec les flèches directionnelles) et affrontez vos propres modèles entraînés.
2.  **Départ Aligné** : Les voitures (humaines et IA) commencent désormais parfaitement alignées avec la direction du premier virage du circuit, évitant les collisions immédiates ou les départs confus.
3.  **Classement en Temps Réel** : Suivez votre position et celle des IA en direct.

## Inspiration & Crédits :

Ce projet s'inspire de plusieurs créations open source pour enrichir l'expérience :

### 1. Physique de Drift

- **Source** : [drift-car par michaelruppe](https://github.com/michaelruppe/drift-car)
- **Implémentation** : Nous avons intégré la structure de la physique de dérapage.
  - Les paramètres `gripStatic`, `gripDynamic` et la détection de dérapage (`isDrifting`) sont implémentés dans la classe véhicule.
  - Cette logique permet de détecter les virages serrés à haute vitesse, posant les bases pour une simulation de course plus technique.
  - La gestion de l'`adhérence` (grip) change lorsque la voiture dérape, permettant ces glissades contrôlées satisfaisantes.

### 2. Caméra Dynamique (Zoom)

- **Source** : [Sketch p5.js par simranAA](https://editor.p5js.org/simranAA/sketches/sINw8V5Az) (style Agar.io)
- **Logique** :
  - Utilisation de la transformation `translate(width/2, height/2)` pour centrer la vue sur le joueur.
  - Application d'un `scale(startingRadius / blob.r)` (adapté ici à la vitesse/taille) pour créer un effet de zoom dynamique : la caméra recule quand la voiture accélère ou grandit, donnant une meilleure visibilité sur le circuit.
  - `translate(-player.pos.x, -player.pos.y)` pour suivre la position exacte du véhicule.

## Conclusion :

Le but de ce jeu est de s'amuser avec ces paramètre pour générer des models puissants et les comparer ensuite en mode course !

https://github.com/user-attachments/assets/1613745b-e98e-49eb-97c5-c75076a42e4b
