LLM cloud au lieu d'Ollama local — c'est explicitement une « obligation technique minimale ». Le projet utilise Gemini via API Google. Risque : note plafonnée car non conforme à l'esprit du Lab « Local Intelligence ».

README incohérent — il parle encore d'OpenRouter alors que le code est passé à Gemini (cf. README.md:34-36 vs app/config.py). Et il ne mentionne pas le nouveau flow de saisie de clé via UI.

Pas de Makefile (optionnel mais c'est un bonus facile).

Pas de rapport PDF ni de diagrammes UML (livrables exigés).

Planification très légère — un routeur 2-branches ne couvre pas « planificateur / task manager / scheduler ». Le mot « planification » dans le critère 5 suggère un planner multi-étapes ou un agent superviseur.

Gouvernance peu visible — il y a app/security/prompt_guard.py mais pas de logs d'audit structurés, pas de traces, pas de gestion de rôles.

Pas de tests sur 2 machines documenté.