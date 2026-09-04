# Cendre

Prototype mobile-first d’un jeu de survie sociale multijoueur. Chaque joueur utilise son téléphone tandis que les discussions restent autour de la table.

## Tester la boucle

```bash
npm install
npm run dev
```

Ouvrir `http://localhost:3000`, puis choisir **Lancer la démo immédiate**. Dans le lobby, le bouton de test ajoute Maya et Noé afin de parcourir la partie sans trois appareils.

Le mode local persiste une partie par code dans le navigateur et synchronise les onglets avec `BroadcastChannel`. Ce mode sert uniquement au playtest. Le multitéléphone sécurisé utilise les projections Supabase décrites dans [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Ce que le prototype démontre

- création, code, lobby et personnages semi-aléatoires ;
- sélection d’équipement sous contrainte ;
- ressources collectives et consommation quotidienne ;
- dix événements data-driven sans répétition ;
- décisions collectives et privées ;
- expédition, séparation, blessure temporaire et séquelle ;
- conséquence différée, mort par pénurie et évacuation ;
- journal de partie et écran final ;
- manifeste PWA et interface mobile.

## Documentation

- [Architecture, game design, données et machine à états](docs/ARCHITECTURE.md)
- [Branchement Supabase](docs/SUPABASE_SETUP.md)

## Vérification

```bash
npm test
npm run lint
npm run build
```

