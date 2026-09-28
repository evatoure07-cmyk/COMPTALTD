# Comptabilité LTD Sandy Shores — nouveau site indépendant

Ce dossier est un site **entièrement neuf**. Il ne dépend pas de l'ancienne tablette LTD et n'écrase aucun ancien fichier.

## Accès
Code : `D42TAT`

## Fonctionnalités
- Tableau de bord hebdomadaire
- Recettes, dépenses, subventions et impôts payés
- Déductibilité avec plafonds avocat / comptable
- Employés, CA, commissions, salaires prévus et paiements
- Calcul des commandes d'essence (litres → bidons → facture)
- Résultat imposable + tranches d'impôt configurables
- Contrôle de masse salariale
- Clôtures hebdomadaires et archives
- Export JSON + CSV / import JSON
- Mode local immédiat + mode Supabase pour synchronisation multi-PC

## Mise en ligne GitHub Pages
1. Crée un nouveau dépôt GitHub (ex. `ltd-sandy-comptabilite`).
2. Mets **tous les fichiers** de ce dossier à la racine du dépôt.
3. GitHub > Settings > Pages > Deploy from a branch > `main` / root.
4. Ouvre l'URL GitHub Pages fournie.

## Synchroniser sur plusieurs PC (optionnel mais conseillé)
1. Crée un projet Supabase.
2. Dans SQL Editor, exécute `supabase.sql`.
3. Dans Project Settings > API, copie l'URL du projet et la clé `anon/public`.
4. Ouvre `cloud-config.js` et mets :

```js
window.LTD_CLOUD = {
  enabled: true,
  url: "https://TON-PROJET.supabase.co",
  anonKey: "TA_CLE_ANON"
};
```

5. Redéploie le site.

Le site stocke alors l'état partagé dans `ltd_compta_state` et se synchronise à chaque modification.

## Règles préconfigurées
Le site reprend la logique de gestion LTD utilisée comme référence :
- masse salariale : alerte 85 %, plafond 90 % (modifiable)
- avocat : plafond déductible 30 000 $
- comptable : plafond déductible 8 000 $
- paiements d'impôt exclus de l'assiette
- subventions séparées du CA imposable
- barème par défaut : 10 % / 19 % / 28 % / 36 % / 46 % selon les tranches configurées
- essence : 15 L par bidon, 60 $ normal, 52,50 $ partenaire (modifiable)

Tout est modifiable dans **Paramètres État**.
