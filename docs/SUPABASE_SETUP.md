# Brancher Supabase

Le prototype démarre volontairement avec un adaptateur local pour permettre un test immédiat. Pour jouer sur plusieurs téléphones :

1. créer un projet Supabase et activer les connexions anonymes dans Authentication ;
2. appliquer la migration de `supabase/migrations` ;
3. définir les variables de `.env.example` dans l’environnement serveur ;
4. implémenter le gestionnaire de commandes autoritaire décrit dans `docs/ARCHITECTURE.md` ;
5. ne jamais exposer `SUPABASE_SECRET_KEY` avec un préfixe `NEXT_PUBLIC_`.

La table `game_views` est la seule surface gameplay lisible par le navigateur. Realtime invalide cette projection ; le client la recharge ensuite. Les tables canoniques ont RLS activé et leurs droits sont révoqués pour `anon` et `authenticated`.

Supabase a modifié en 2026 l’exposition automatique des nouvelles tables et verrouillé le schéma `realtime`. La migration accorde donc explicitement le seul droit requis et ne crée aucun objet dans ce schéma.

