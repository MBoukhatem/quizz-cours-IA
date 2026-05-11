# Cours : Bases du langage Python

## Chapitre 1 — Introduction au langage

Python est un langage de programmation interprété, multi-paradigme et à typage dynamique. Il a été créé par Guido van Rossum et publié pour la première fois en 1991. Le langage met l'accent sur la lisibilité du code grâce à une syntaxe claire et une indentation significative.

Python suit le principe « il n'y a qu'une et une seule manière de le faire » (the Zen of Python). Il est largement utilisé en science des données, en intelligence artificielle, en développement web et en automatisation.

L'extension standard d'un fichier Python est `.py`. Pour exécuter un programme depuis le terminal, on utilise la commande `python mon_fichier.py`.

## Chapitre 2 — Types de données fondamentaux

Les types primitifs de Python sont les suivants :

- **int** : entiers de précision arbitraire, par exemple `42`, `-7`, `1000000`.
- **float** : nombres à virgule flottante, par exemple `3.14`, `-0.001`, `2.0`.
- **bool** : valeurs booléennes, soit `True`, soit `False`.
- **str** : chaînes de caractères, délimitées par des guillemets simples `'...'` ou doubles `"..."`.
- **NoneType** : la valeur spéciale `None` représente l'absence de valeur.

Python est à typage dynamique : une variable n'a pas de type fixe, elle prend le type de l'objet auquel elle se réfère. La fonction `type(x)` retourne le type de la variable `x`.

## Chapitre 3 — Structures de données

Python propose plusieurs structures de données natives essentielles.

### Listes

Une liste est une séquence ordonnée et mutable d'éléments. Elle s'écrit entre crochets : `ma_liste = [1, 2, 3]`. On accède aux éléments par index, en commençant à zéro : `ma_liste[0]` vaut 1. Les listes supportent les méthodes `append`, `remove`, `sort`, et la fonction `len`.

### Tuples

Un tuple est une séquence ordonnée mais immutable. Il s'écrit entre parenthèses : `mon_tuple = (1, 2, 3)`. On l'utilise pour représenter des données qui ne doivent pas changer après leur création.

### Dictionnaires

Un dictionnaire associe des clés à des valeurs. Il s'écrit avec des accolades : `d = {"nom": "Alice", "age": 30}`. On accède à une valeur par sa clé : `d["nom"]`. Les dictionnaires sont mutables et les clés doivent être immutables.

### Ensembles

Un ensemble (`set`) est une collection non ordonnée d'éléments uniques : `mon_set = {1, 2, 3}`. Il est utile pour tester l'appartenance ou éliminer les doublons.

## Chapitre 4 — Contrôle de flux

### Conditions

L'instruction `if / elif / else` permet d'exécuter du code sous condition. L'indentation détermine le bloc :

```
if x > 0:
    print("positif")
elif x == 0:
    print("zero")
else:
    print("negatif")
```

### Boucles

La boucle `for` itère sur une séquence. Par exemple, `for i in range(5):` parcourt les entiers de 0 à 4 inclus. La boucle `while` répète tant qu'une condition est vraie.

Les mots-clés `break` interrompt la boucle, et `continue` passe à l'itération suivante sans exécuter la suite du bloc.

## Chapitre 5 — Fonctions

Une fonction est définie avec le mot-clé `def`. Elle peut avoir des paramètres avec des valeurs par défaut et retourner un résultat avec `return`.

```
def addition(a, b=0):
    return a + b
```

Les fonctions sont des objets de première classe en Python : on peut les passer en argument, les retourner, et les stocker dans des structures de données.

Les fonctions lambda permettent de définir une fonction anonyme courte : `carre = lambda x: x * x`.

## Chapitre 6 — Complexité algorithmique

La complexité d'un algorithme exprime comment son coût (en temps ou en mémoire) varie selon la taille de l'entrée `n`.

- **O(1)** : constant. Accès à un élément d'une liste par index.
- **O(log n)** : logarithmique. Recherche dichotomique dans une liste triée.
- **O(n)** : linéaire. Parcourir une liste entière.
- **O(n log n)** : quasi-linéaire. Tris efficaces comme le tri fusion ou le tri rapide en moyenne.
- **O(n^2)** : quadratique. Tri par insertion ou tri par sélection sur une liste de taille `n`.
- **O(2^n)** : exponentiel. Algorithmes naïfs de force brute (par exemple, énumération de tous les sous-ensembles).

Le tri par insertion a une complexité en O(n^2) dans le pire cas et en moyenne. Le tri fusion garantit O(n log n) dans tous les cas.

## Chapitre 7 — Bonnes pratiques

Le style de code Python est défini par la PEP 8 : indentation de 4 espaces, noms de variables en `snake_case`, noms de classes en `CamelCase`, lignes limitées à 79 caractères de préférence.

L'utilisation des annotations de type (`def f(x: int) -> str:`) est encouragée pour améliorer la lisibilité et activer l'analyse statique avec des outils comme `mypy`.

Les exceptions sont gérées avec `try / except / finally`. Il est recommandé d'attraper des exceptions spécifiques plutôt qu'un `except` nu.
