# Brancher Supabase

Le prototype démarre volontairement avec un adaptateur local pour permettre un test immédiat. Pour jouer sur plusieurs téléphones :

1. créer un projet Supabase et activer les connexions anonymes dans Authentication ;
2. appliquer les migrations de `supabase/migrations` dans l’ordre ;
3. définir les variables de `.env.example` dans Vercel ;
4. redéployer l’application après l’ajout des variables ;
5. ne jamais exposer `SUPABASE_SECRET_KEY` avec un préfixe `NEXT_PUBLIC_`.

La table `game_views` est la seule surface gameplay lisible par le navigateur. Les fonctions RPC authentifiées créent, rejoignent et sauvegardent une partie dans une transaction. Realtime invalide ensuite la projection et le client la recharge. Les tables canoniques ont RLS activé et leurs droits sont révoqués pour `anon` et `authenticated`.

Le chat est enregistré dans l’état canonique, puis retiré de chaque projection sauf pour l’expéditeur, le destinataire et l’éventuel joueur ayant détecté la conversation.

Supabase a modifié en 2026 l’exposition automatique des nouvelles tables et verrouillé le schéma `realtime`. La migration accorde donc explicitement le seul droit requis et ne crée aucun objet dans ce schéma.
