# QuoteForge

Générateur de devis professionnels, 100% HTML/CSS/JavaScript, sans backend. Tout est stocké localement dans le navigateur (`localStorage`) et le PDF est généré côté client.

## Lancer le projet

Ouvrez simplement `index.html` dans votre navigateur. Aucun serveur requis.

## Structure

```
index.html
css/
  variables.css     tokens (couleurs, rayons, ombres, typo)
  base.css           reset, scrollbars, focus, animations
  layout.css         en-tête, grille formulaire/aperçu, tiroir
  components.css     boutons, champs, cartes, tableau, badges, toasts
  preview.css        le "papier" du devis (capturé pour le PDF)
js/
  app.js              version concaténée (tout-en-un, chargement direct)
  (quote.js, calculator.js, preview.js, history-manager.js,
   history-ui.js, pdf-generator.js, toast.js, script.js — sources)
```

## Notes

- La devise par défaut est le FCFA (XOF), modifiable par devis (EUR, USD).
- Chaque devis est auto-enregistré dans l'historique pendant la saisie (avec un léger délai), et reste accessible via le bouton *Historique*.
- Le PDF est une capture fidèle de l'aperçu : tout ce qui s'affiche à l'écran est exactement ce qui sera téléchargé.
- Aucune dépendance à installer : `jsPDF` et `html2canvas` sont chargés depuis cdnjs.
