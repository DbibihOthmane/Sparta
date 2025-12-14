# Description de projet : Sparta-car

## ***Très important*** : 
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


## Conclusion :
Le but de ce jeu est de s'amuser avec ces paramètre pour générer des models puissants et les comparer ensuite en mode course !


