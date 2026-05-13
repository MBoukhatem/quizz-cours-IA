# Introduction au Machine Learning supervise

## 1. Definition

Le Machine Learning (apprentissage automatique) est une branche de l'intelligence artificielle
qui permet a un systeme informatique d'apprendre a partir de donnees sans etre explicitement
programme pour chaque tache. Au lieu de suivre des regles codees en dur, le systeme identifie
des patterns dans les donnees et generalise ces patterns pour faire des predictions sur de
nouvelles donnees.

Un modele de Machine Learning est une fonction mathematique f(x) que l'on apprend a partir d'un
ensemble de donnees d'entrainement {(x_i, y_i)}, ou x_i est un vecteur de caracteristiques et
y_i est la valeur cible associee.

## 2. Apprentissage supervise vs non supervise

### Apprentissage supervise

Dans l'apprentissage **supervise**, chaque exemple d'entrainement est accompagne d'une etiquette
(label) fournie par un superviseur humain. Le modele apprend a predire cette etiquette a partir
des caracteristiques d'entree. On distingue deux grandes categories :

- **Classification** : la cible y est une categorie discrete (ex. : spam/non-spam, chat/chien).
- **Regression** : la cible y est une valeur continue (ex. : prix d'un appartement, temperature).

### Apprentissage non supervise

Dans l'apprentissage **non supervise**, les donnees ne comportent pas d'etiquettes. L'algorithme
cherche a decouvrir une structure cachee : regroupement (clustering), reduction de dimension,
detection d'anomalies. Exemples : k-means, PCA, autoencodeurs.

Le present document se concentre exclusivement sur l'apprentissage supervise.

## 3. Algorithmes principaux

### 3.1 Regression lineaire

La regression lineaire modelise la relation entre les variables d'entree x et une sortie continue
y par une fonction affine : y = w^T x + b. Les parametres w (poids) et b (biais) sont estimes
en minimisant l'erreur quadratique moyenne (MSE) sur l'ensemble d'entrainement.

Avantages : interpretable, rapide a entrainer, fonctionne bien quand la relation est lineaire.
Limites : incapable de capturer des relations non lineaires sans ingenierie des caracteristiques.

### 3.2 Arbre de decision

Un arbre de decision partitionne recursivement l'espace des caracteristiques en regions
homogenes. A chaque noeud, l'algorithme choisit la caracteristique et le seuil qui maximisent
un critere de purete (Gini ou entropie pour la classification, variance pour la regression).

Avantages : tres interpretable (visualisation directe), gere les variables categorielles,
aucune normalisation requise.
Limites : prone au surapprentissage si l'arbre est trop profond ; sensible aux petites
variations des donnees.

### 3.3 SVM — Support Vector Machine

Le SVM recherche l'hyperplan de separation qui maximise la marge entre les deux classes les plus
proches (vecteurs supports). Grace au "kernel trick", il peut apprendre des frontieres non
lineaires en projetant implicitement les donnees dans un espace de dimension superieure.

Noyaux courants : lineaire, polynomial, RBF (radial basis function).

Avantages : efficace en haute dimension, robuste au surapprentissage dans les espaces denses.
Limites : couteux en temps de calcul pour de grands jeux de donnees ; choix du noyau delicat.

### 3.4 k plus proches voisins (kNN)

L'algorithme kNN est non parametrique et paresseux (lazy) : il ne construit aucun modele
explicite. Pour classifier un nouvel exemple, il recherche les k exemples d'entrainement les
plus proches (distance euclidienne par defaut) et retourne la classe majoritaire.

Avantages : simple, aucune phase d'entrainement, naturellement multi-classes.
Limites : lent a l'inference pour de grandes bases, sensible a l'echelle des caracteristiques
(normalisation obligatoire), performances degradees en haute dimension (malediction de la
dimensionnalite).

## 4. Metriques d'evaluation

### 4.1 Classification

- **Accuracy** (precision globale) : proportion d'exemples correctement classes.
  Accuracy = (VP + VN) / (VP + VN + FP + FN)
  Limite : trompeuse sur des jeux desequilibres (ex. 99 % d'une classe).

- **Precision et Rappel** : metriques complementaires pour les classes positives.
  Precision = VP / (VP + FP) ; Rappel = VP / (VP + FN).

- **F1-score** : moyenne harmonique de la precision et du rappel, utile quand les classes
  sont desequilibrees.

### 4.2 Regression

- **MSE** (Mean Squared Error) : moyenne des carres des erreurs. Penalise fortement les
  grandes erreurs.
- **RMSE** (Root MSE) : racine carree du MSE, dans la meme unite que la cible. Facilite
  l'interpretation.
- **MAE** (Mean Absolute Error) : moyenne des valeurs absolues des erreurs. Plus robuste
  aux valeurs aberrantes que le MSE.

## 5. Surapprentissage et regularisation

Le **surapprentissage** (overfitting) survient quand un modele apprend le bruit des donnees
d'entrainement au lieu de la relation sous-jacente. Il se manifeste par une erreur d'entrainement
tres faible mais une erreur de test elevee.

Principales parades :

- **Regularisation L1/L2** : ajoute une penalite sur la norme des poids au critere d'optimisation
  (Lasso pour L1, Ridge pour L2).
- **Validation croisee** (cross-validation) : evalue le modele sur plusieurs partitions
  entrainement/test pour obtenir une estimation robuste des performances.
- **Early stopping** : arrete l'entrainement des qu'une metrique de validation cesse de
  s'ameliorer.
- **Augmentation des donnees** : genere de nouveaux exemples artificiels pour enrichir le jeu
  d'entrainement.

Le **sous-apprentissage** (underfitting) est le probleme inverse : le modele est trop simple pour
capturer la complexite des donnees. Le compromis biais-variance guide le choix de la complexite
du modele.

## 6. Bonne pratique : separation train / validation / test

Avant tout entrainement, les donnees doivent etre divisees en trois ensembles disjoints :

1. **Entrainement** (~70 %) : ajustement des parametres du modele.
2. **Validation** (~15 %) : selection des hyperparametres et arret precoce.
3. **Test** (~15 %) : evaluation finale, consultee une seule fois.

Contaminer le jeu de test pendant le developpement conduit a une evaluation optimiste et a
des modeles qui ne generalisent pas en production.
