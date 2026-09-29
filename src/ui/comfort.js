
/* ============================================================================
   Confort : ecran d'accueil, aide « ? » de chaque graphique, lien de partage
   d'une vue, annuler / retablir, export PDF, version anglaise, telephone.
   ============================================================================ */

/* ---------------------------------------------------------------- ecran d'accueil */
const Welcome = {
  build() {
    if ($("#welcome")) return;
    const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
    document.body.insertAdjacentHTML("beforeend", `<div class="wel-back" id="welcome" hidden><div class="wel" role="dialog" aria-modal="true" aria-labelledby="welTitle">
      <button class="wel-x" type="button" data-wel="close" aria-label="Fermer">×</button>
      <div class="eyebrow">Prisme Studio</div>
      <h2 id="welTitle">La structure de vos données, en 3D.</h2>
      <p class="wel-lead">ACP, ACM, AFC et AFDM calculées dans votre navigateur, avec les interprétations du cours. Vos données ne quittent jamais votre poste.</p>
      <div class="wel-grid">
        <button class="wel-c" type="button" data-wel="example">${ic('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>')}<b>Essayer un exemple</b><span>Des données prêtes à explorer pour découvrir l'outil en une minute.</span></button>
        <button class="wel-c" type="button" data-wel="file">${ic('<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>')}<b>Ouvrir mon fichier</b><span>CSV, Excel, JSON ou Parquet, une ligne par individu. Jusqu'à 500 000 lignes.</span></button>
        <button class="wel-c" type="button" data-wel="big">${ic('<path d="M4 20V10M9 20V4M14 20v-8M19 20V7"/>')}<b>Grand fichier</b><span>Plusieurs millions de lignes : lecture en flux, ACP exacte, carte de densité.</span></button>
      </div>
      <div class="wel-ex" id="welEx" hidden></div>
      <ol class="wel-steps"><li><b>Déposez</b> un fichier n'importe où sur la page</li><li><b>Prisme choisit</b> la méthode et les axes</li><li><b>Explorez</b>, puis exportez le rapport en PDF</li></ol>
      <label class="wel-no"><input type="checkbox" id="welNo"> Afficher à chaque démarrage</label>
    </div></div>`);
    $("#welcome").addEventListener("click", e => {
      if (e.target.id === "welcome") return this.close();
      const b = e.target.closest("[data-wel],[data-welex]"); if (!b) return;
      if (b.dataset.welex) { const k = b.dataset.welex, ex = EXEMPLES[k]; this.close(); if (state.example !== k) loadTable(parseCSV(ex.csv, ex.file), ex.file, k); return; }
      const a = b.dataset.wel;
      if (a === "close") return this.close();
      if (a === "example") { const box = $("#welEx"); box.hidden = !box.hidden; if (!box.hidden) box.innerHTML = Object.entries(EXEMPLES).map(([k, x]) => `<button type="button" class="ex" data-welex="${k}"><span class="m">${x.m}</span><span><b>${esc(x.label)}</b><span>${esc(x.sub)}</span></span></button>`).join(""); return; }
      // l'ouverture du selecteur de fichier doit rester dans le geste de l'utilisateur : clic d'abord, fermeture ensuite
      if (a === "file" || a === "big") { $("#bigForce").checked = a === "big"; $("#fileInput").click(); this.close(); }
    });
    $("#welNo").addEventListener("change", e => { try { localStorage.setItem("prisme-welcome", e.target.checked ? "always" : "seen"); } catch (err) {} });
  },
  show() { this.build(); $("#welcome").hidden = false; try { $("#welNo").checked = localStorage.getItem("prisme-welcome") === "always"; } catch (e) {} setTimeout(() => $('#welcome [data-wel="example"]')?.focus(), 30); },
  close() { const w = $("#welcome"); if (w) w.hidden = true; },
  get open() { return !!$("#welcome") && !$("#welcome").hidden; },
  // a la premiere visite, puis seulement si « afficher a chaque demarrage » est coche
  auto() { let v = null; try { v = localStorage.getItem("prisme-welcome"); if (v !== "always") localStorage.setItem("prisme-welcome", "seen"); } catch (e) {} if (v === null || v === "always") this.show(); },
};

/* ---------------------------------------------------------------- aide des graphiques */
// pour chaque titre de graphique : ce que c'est, comment le lire, le piege a eviter (francais, anglais)
const HELP = {
  "stage": { t: ["Espace factoriel en 3D", "3D factor space"], fr: ["Chaque point est un individu (ou une modalité) placé selon ses coordonnées sur les trois premiers axes.", "Deux points proches ont des profils proches. Les flèches (ACP) montrent le sens de chaque variable. Faites tourner, zoomez, sélectionnez au lasso.", "La 3D ne montre qu'une partie de l'information : regardez le pourcentage des axes avant de conclure."], en: ["Each point is an individual (or a category) placed by its coordinates on the first three axes.", "Close points have similar profiles. Arrows (PCA) show the direction of each variable. Rotate, zoom, select with the lasso.", "The 3D view shows only part of the information: check the axes' percentages before concluding."] },
  "Cercle des corrélations": { t: ["Cercle des corrélations", "Correlation circle"], fr: ["Chaque flèche est une variable ; ses coordonnées sont ses corrélations avec les deux axes.", "Flèches proches : variables corrélées. Opposées : corrélées négativement. À angle droit : indépendantes. Une flèche proche du cercle est bien représentée.", "Une flèche courte est mal représentée sur ce plan : ne l'interprétez pas."], en: ["Each arrow is a variable; its coordinates are its correlations with the two axes.", "Close arrows: correlated variables. Opposite: negatively correlated. At right angles: unrelated. An arrow near the circle is well represented.", "A short arrow is poorly represented on this plane: do not interpret it."] },
  "Carré des liaisons": { t: ["Carré des liaisons", "Relationship square"], fr: ["Chaque variable, quantitative (r²) ou qualitative (η²), selon sa liaison avec les deux axes.", "Plus une variable est loin de l'origine, plus elle structure le plan. Près d'un axe : elle ne joue que sur cet axe.", "Le carré ne donne pas le sens de la liaison : voyez le cercle et la carte des modalités."], en: ["Each variable, numeric (r²) or categorical (η²), by its link with the two axes.", "The further from the origin, the more the variable shapes the plane. Near one axis: it only drives that axis.", "The square does not give the direction of the link: see the circle and the category map."] },
  "Corrélations": { t: ["Matrice des corrélations", "Correlation matrix"], fr: ["Corrélation de Pearson entre chaque paire de variables, de −1 à +1.", "Bleu : les variables montent ensemble. Orange : l'une monte quand l'autre descend. Les variables sont rangées pour rapprocher les blocs liés.", "Une corrélation ne mesure qu'une liaison linéaire et ne prouve aucune causalité."], en: ["Pearson correlation between each pair of variables, from −1 to +1.", "Blue: variables rise together. Orange: one rises when the other falls. Variables are ordered to bring related blocks together.", "A correlation only measures a linear link and proves no causation."] },
  "Écarts à l'indépendance": { t: ["Écarts à l'indépendance", "Deviations from independence"], fr: ["Effectif observé divisé par l'effectif attendu si lignes et colonnes étaient indépendantes, moins 1.", "Bleu : association plus fréquente qu'au hasard. Orange : plus rare.", "Sur de petits effectifs, un fort écart peut ne reposer que sur quelques observations."], en: ["Observed count divided by the count expected under independence, minus 1.", "Blue: association more frequent than chance. Orange: rarer.", "With small counts, a large deviation may rest on only a few observations."] },
  "Spectre des valeurs propres": { t: ["Valeurs propres", "Eigenvalues"], fr: ["La part d'information (inertie) portée par chaque axe, du plus important au moins important.", "On garde les axes avant le « coude » ou au-dessus de la règle du cours (Kaiser : λ ≥ 1 en ACP).", "Des valeurs propres proches les unes des autres donnent des axes instables : voyez le Labo."], en: ["The share of information (inertia) carried by each axis, from most to least important.", "Keep the axes before the elbow or above the rule (Kaiser: λ ≥ 1 in PCA).", "Close eigenvalues give unstable axes: see the Lab."] },
  "Stabilité des valeurs propres": { t: ["Stabilité (bootstrap)", "Stability (bootstrap)"], fr: ["L'analyse recalculée sur des échantillons tirés au hasard de vos données.", "La barre montre où tombent 95 % des valeurs propres. Des barres qui se chevauchent : l'ordre des axes n'est pas sûr.", "Avec peu d'individus, les intervalles sont larges : restez prudent."], en: ["The analysis recomputed on random resamples of your data.", "Bars show where 95% of eigenvalues fall. Overlapping bars: the order of the axes is uncertain.", "With few individuals the intervals are wide: be careful."] },
  "Validité de l'ACP": { t: ["Validité de l'ACP", "Is PCA appropriate?"], fr: ["Le test de Bartlett vérifie que les variables sont liées ; l'indice KMO mesure si elles partagent assez d'information.", "Bartlett significatif et KMO au-dessus de 0,6 : l'ACP résume bien les données.", "KMO faible : les variables sont peu liées, les axes seront difficiles à interpréter."], en: ["Bartlett's test checks that variables are related; the KMO index measures whether they share enough information.", "Significant Bartlett and KMO above 0.6: PCA summarises the data well.", "Low KMO: variables are weakly related, axes will be hard to interpret."] },
  "Liaison de chaque variable avec les axes": { t: ["Liaison variables-axes", "Variable-axis links"], fr: ["r² pour une quantitative, η² pour une qualitative, sur chaque axe.", "Les variables les plus liées à un axe lui donnent son sens. La somme sur un axe donne sa valeur propre.", "Une qualitative à nombreuses modalités a mécaniquement un η² plus élevé."], en: ["r² for a numeric variable, η² for a categorical one, on each axis.", "The variables most linked to an axis give it its meaning. Their sum on an axis is its eigenvalue.", "A categorical variable with many categories mechanically has a higher η²."] },
  "Liaison variables-axes (η²)": { t: ["Liaison variables-axes (η²)", "Variable-axis links (η²)"], fr: ["Rapport de corrélation η² entre chaque variable et chaque axe.", "Plus η² est proche de 1, plus les modalités de la variable se séparent le long de l'axe.", "Comparez les variables entre elles plutôt qu'à un seuil absolu."], en: ["Correlation ratio η² between each variable and each axis.", "The closer η² is to 1, the more the variable's categories separate along the axis.", "Compare variables with each other rather than with an absolute threshold."] },
  "Coordonnées, contributions, cos²": { t: ["Coordonnées, contributions, cos²", "Coordinates, contributions, cos²"], fr: ["Coordonnée : position sur l'axe. Contribution : part de l'axe due à l'élément. cos² : qualité de sa représentation.", "Pour interpréter un axe, lisez les éléments qui contribuent plus que la moyenne, des deux côtés.", "Un élément à cos² faible est mal représenté : sa position sur le plan est trompeuse."], en: ["Coordinate: position on the axis. Contribution: share of the axis due to the element. cos²: quality of representation.", "To interpret an axis, read the elements contributing more than average, on both sides.", "An element with low cos² is poorly represented: its position on the plane is misleading."] },
  "Représentation superposée": { t: ["Biplot", "Biplot"], fr: ["Individus et variables sur le même plan.", "Un individu du côté d'une flèche a une valeur élevée pour cette variable.", "Les distances entre individus et flèches ne se lisent pas directement : seules les directions comptent."], en: ["Individuals and variables on the same plane.", "An individual on the side of an arrow has a high value for that variable.", "Distances between individuals and arrows are not directly meaningful: only directions are."] },
  "Carte des individus": { t: ["Carte des individus", "Map of individuals"], fr: ["Les individus sur le plan choisi.", "Deux individus proches ont des profils proches ; les groupes visibles sont des profils types.", "Vérifiez le cos² avant d'interpréter un individu isolé."], en: ["Individuals on the chosen plane.", "Close individuals have similar profiles; visible groups are typical profiles.", "Check cos² before interpreting an isolated individual."] },
  "Représentation simultanée": { t: ["Représentation simultanée", "Symmetric map"], fr: ["Lignes et colonnes du tableau sur le même plan.", "Une ligne proche d'une colonne y est sur-représentée. Deux lignes proches ont des profils proches.", "En carte symétrique, la distance ligne-colonne n'est qu'une indication : confirmez avec les écarts à l'indépendance."], en: ["Rows and columns of the table on the same plane.", "A row close to a column is over-represented there. Two close rows have similar profiles.", "In a symmetric map the row-column distance is only indicative: confirm with deviations from independence."] },
  "Carte des modalités": { t: ["Carte des modalités", "Category map"], fr: ["Chaque modalité est placée au centre de gravité des individus qui la possèdent.", "Des modalités proches sont souvent choisies ensemble. Loin du centre : modalité rare ou très typée.", "Les modalités rares s'écartent mécaniquement du centre."], en: ["Each category sits at the centre of gravity of the individuals who have it.", "Close categories are often chosen together. Far from the centre: rare or very typical category.", "Rare categories mechanically move away from the centre."] },
  "Tous les individus": { t: ["Table des individus", "Individuals table"], fr: ["Coordonnées, cos² et contributions de chaque individu.", "Triez par contribution pour voir qui construit les axes ; cliquez une ligne pour le retrouver dans la 3D.", "Un individu à très forte contribution peut à lui seul orienter un axe."], en: ["Coordinates, cos² and contributions of each individual.", "Sort by contribution to see who builds the axes; click a row to find it in 3D.", "One individual with a huge contribution can orient an axis on its own."] },
  "Voisins les plus proches": { t: ["Voisins les plus proches", "Nearest neighbours"], fr: ["Les individus les plus proches dans l'espace complet, pas seulement sur le plan.", "Ce sont les profils les plus semblables à celui choisi.", "Deux points proches sur le plan peuvent être éloignés dans l'espace complet."], en: ["The closest individuals in the full space, not just on the plane.", "These are the profiles most similar to the chosen one.", "Two points close on the plane can be far apart in the full space."] },
  "Insights automatiques": { t: ["Insights automatiques", "Automatic insights"], fr: ["Des faits remarquables repérés automatiquement : liaisons, groupes, atypiques, formes.", "Chaque carte donne un score de force ; cliquez pour voir les points concernés.", "Ce sont des pistes : vérifiez-les avant de les présenter comme des conclusions."], en: ["Remarkable facts found automatically: links, groups, outliers, shapes.", "Each card has a strength score; click to see the points involved.", "These are leads: check them before presenting them as conclusions."] },
  "Atlas des projections": { t: ["Atlas des projections", "Projection atlas"], fr: ["Le même nuage vu par l'ACP (linéaire), t-SNE et UMAP (non linéaires).", "Des groupes séparés dans les trois : structure solide. Seulement en t-SNE ou UMAP : structure locale.", "En t-SNE et UMAP, taille des groupes et distances entre groupes ne se lisent pas."], en: ["The same cloud seen by PCA (linear), t-SNE and UMAP (non-linear).", "Groups separated in all three: solid structure. Only in t-SNE or UMAP: local structure.", "In t-SNE and UMAP, cluster sizes and distances between clusters are not meaningful."] },
  "Fidélité de la projection": { t: ["Fidélité de la projection", "Projection fidelity"], fr: ["Chaque point est une paire : distance réelle contre distance vue sur les premiers axes.", "Près de la diagonale : la projection respecte les distances. Loin dessous : des points éloignés semblent proches.", "Une projection ne peut que rapprocher : tout est sous la diagonale."], en: ["Each point is a pair: true distance against distance seen on the first axes.", "Near the diagonal: distances are preserved. Far below: distant points look close.", "A projection can only bring points closer: everything lies below the diagonal."] },
  "Classification hiérarchique sur composantes principales": { t: ["Classification (HCPC)", "Clustering (HCPC)"], fr: ["Classification de Ward sur les axes retenus, consolidée par k-means.", "Chaque classe est décrite par les variables et modalités qui la distinguent (valeurs-tests).", "Le nombre de classes est une proposition : essayez-en d'autres."], en: ["Ward clustering on the retained axes, consolidated by k-means.", "Each cluster is described by the variables and categories that set it apart (test values).", "The number of clusters is a suggestion: try others."] },
  "Dendrogramme": { t: ["Dendrogramme", "Dendrogram"], fr: ["L'arbre des regroupements successifs ; la hauteur est l'inertie perdue à chaque fusion.", "Coupez là où les branches sont longues : les classes y sont bien séparées.", "Deux feuilles voisines sur l'arbre ne sont pas forcément proches dans les données."], en: ["The tree of successive merges; height is the inertia lost at each merge.", "Cut where branches are long: clusters are well separated there.", "Two neighbouring leaves are not necessarily close in the data."] },
  "Gains d'inertie": { t: ["Gains d'inertie", "Inertia gains"], fr: ["Inertie gagnée à chaque division de l'arbre.", "La coupure se place avant le premier grand affaissement.", "Plusieurs sauts comparables : plusieurs découpages sont défendables."], en: ["Inertia gained at each split of the tree.", "Cut before the first big drop.", "Several comparable drops: several partitions are defensible."] },
  "Classification k-means sur les axes retenus": { t: ["k-means", "k-means"], fr: ["Partition en k groupes par la méthode des centres mobiles, sur les axes retenus.", "Le R² indique la part d'inertie expliquée par la partition.", "k-means dépend de son point de départ et suppose des groupes compacts."], en: ["Partition into k groups by k-means, on the retained axes.", "R² is the share of inertia explained by the partition.", "k-means depends on its start and assumes compact groups."] },
  "Matrice de nuages et scagnostics": { t: ["Matrice de nuages", "Scatterplot matrix"], fr: ["Tous les croisements de variables deux à deux, avec des mesures de forme (scagnostics).", "Repérez les formes remarquables : amas, courbes, points isolés, stries.", "Avec beaucoup de points, les formes sont calculées sur un échantillon."], en: ["All pairwise plots, with shape measures (scagnostics).", "Look for remarkable shapes: clumps, curves, isolated points, stripes.", "With many points, shapes are computed on a sample."] },
  "Paires les plus remarquables": { t: ["Paires remarquables", "Remarkable pairs"], fr: ["Les paires de variables classées selon la mesure de forme choisie.", "En tête : les nuages les plus typés pour cette mesure.", "Un score élevé attire l'œil, il ne dit pas si la forme a un sens métier."], en: ["Variable pairs ranked by the chosen shape measure.", "At the top: the most typical plots for this measure.", "A high score draws the eye; it does not say whether the shape matters."] },
  "Matrice de Bertin": { t: ["Matrice de Bertin", "Bertin matrix"], fr: ["Le tableau de données en couleurs, lignes et colonnes réordonnées selon l'axe 1.", "Les blocs de couleur révèlent les groupes d'individus et de variables qui vont ensemble.", "L'ordre dépend de l'axe 1 : une structure portée par l'axe 2 peut rester cachée."], en: ["The data table as colours, rows and columns reordered along axis 1.", "Colour blocks reveal groups of individuals and variables that go together.", "The order depends on axis 1: structure carried by axis 2 may stay hidden."] },
  "Tableau réordonné": { t: ["Tableau réordonné", "Reordered table"], fr: ["Lignes et colonnes rangées selon leur coordonnée sur l'axe 1.", "La diagonale d'attractions (bleu) montre la structure que l'AFC résume.", "Les cases à faible effectif peuvent afficher de forts écarts peu fiables."], en: ["Rows and columns ordered by their axis-1 coordinate.", "The diagonal of attractions (blue) shows the structure summarised by CA.", "Cells with small counts can show large, unreliable deviations."] },
  "Tableau de Burt réordonné": { t: ["Tableau de Burt", "Burt table"], fr: ["Tous les croisements des variables qualitatives deux à deux.", "Les cases bleues indiquent des modalités souvent associées.", "La diagonale croise une variable avec elle-même : ignorez-la."], en: ["All pairwise crossings of the categorical variables.", "Blue cells show categories often found together.", "The diagonal crosses a variable with itself: ignore it."] },
  "Hyperespace": { t: ["Hyperespace", "Hyperspace"], fr: ["Des outils pour voir au-delà de trois dimensions : coordonnées parallèles, réseau, signatures, reconstruction.", "Chaque vue répond à une question : qui ressemble à qui, quelles variables vont ensemble, ce que perdent les axes.", "Ces vues complètent la 3D, elles ne la remplacent pas."], en: ["Tools to see beyond three dimensions: parallel coordinates, network, signatures, reconstruction.", "Each view answers a question: who looks like whom, which variables go together, what the axes lose.", "These views complement the 3D, they do not replace it."] },
  "Coordonnées parallèles": { t: ["Coordonnées parallèles", "Parallel coordinates"], fr: ["Une ligne par individu, un axe vertical par variable.", "Des lignes parallèles entre deux axes : corrélation positive. Croisées : négative. Glissez sur un axe pour filtrer.", "L'ordre des axes change la lecture : il suit ici le cercle des corrélations."], en: ["One line per individual, one vertical axis per variable.", "Parallel lines between two axes: positive correlation. Crossing: negative. Drag on an axis to filter.", "Axis order changes the reading: here it follows the correlation circle."] },
  "Réseau des corrélations": { t: ["Réseau des corrélations", "Correlation network"], fr: ["Les variables reliées quand leur corrélation dépasse le seuil.", "En mode partiel, un lien qui disparaît était indirect (dû à une autre variable).", "Le seuil est arbitraire : faites-le varier."], en: ["Variables linked when their correlation exceeds the threshold.", "In partial mode, a link that disappears was indirect (due to another variable).", "The threshold is arbitrary: vary it."] },
  "Signatures": { t: ["Signatures", "Signatures"], fr: ["Chaque individu devient une étoile : un rayon par variable, en écarts-types.", "Des étoiles de même forme : profils semblables. Elles sont triées selon l'axe 1.", "La forme dépend de l'ordre des rayons."], en: ["Each individual becomes a star: one ray per variable, in standard deviations.", "Stars with the same shape: similar profiles. They are sorted by axis 1.", "The shape depends on the order of the rays."] },
  "Reconstruction du tableau": { t: ["Reconstruction du tableau", "Table reconstruction"], fr: ["Les données recalculées à partir des seuls premiers axes.", "Ce qui reste bien reconstruit est ce que les axes résument ; les écarts, ce qu'ils perdent.", "Ajouter des axes améliore toujours la reconstruction, y compris en reproduisant du bruit."], en: ["The data recomputed from the first axes only.", "What is well rebuilt is what the axes summarise; the gaps are what they lose.", "Adding axes always improves reconstruction, noise included."] },
  "Détecteur d'atypiques": { t: ["Détecteur d'atypiques", "Outlier detector"], fr: ["T² mesure si un individu est extrême dans le plan retenu ; Q mesure ce qui lui reste hors de ces axes.", "Au-delà des limites à 95 % : individu à examiner. Q fort : profil différent des autres.", "Environ 5 % des individus dépassent une limite par hasard."], en: ["T² measures whether an individual is extreme in the retained plane; Q measures what remains outside these axes.", "Beyond the 95% limits: an individual to examine. High Q: a profile unlike the others.", "About 5% of individuals exceed a limit by chance."] },
  "Flux d'inertie": { t: ["Flux d'inertie", "Inertia flow"], fr: ["D'où vient l'inertie de chaque axe : quelles variables ou modalités la fournissent.", "Les rubans larges montrent les éléments qui construisent l'axe.", "C'est une décomposition exacte : la somme redonne la valeur propre."], en: ["Where each axis's inertia comes from: which variables or categories supply it.", "Wide ribbons show the elements that build the axis.", "It is an exact decomposition: the sum gives the eigenvalue."] },
  "Variable cible": { t: ["Variable cible", "Target variable"], fr: ["La variable à expliquer : un défaut, un achat, un montant.", "Elle devient illustrative : elle ne construit pas les axes qu'on utilise pour l'expliquer.", "Choisissez une cible qui n'est pas elle-même calculée à partir des autres colonnes."], en: ["The variable to explain: a default, a purchase, an amount.", "It becomes supplementary: it does not build the axes used to explain it.", "Choose a target that is not itself computed from the other columns."] },
  "Par où commencer": { t: ["Choisir une cible", "Choosing a target"], fr: ["Les variables binaires (0/1, oui/non) sont les cibles les plus naturelles.", "Choisissez la cible, puis la modalité « positive » (par exemple défaut = 1).", "Une cible numérique donne un arbre de régression (moyennes par feuille)."], en: ["Binary variables (0/1, yes/no) are the most natural targets.", "Choose the target, then the positive value (for example default = 1).", "A numeric target gives a regression tree (means per leaf)."] },
  "Ce qui explique": { t: ["Importance des variables", "Variable importance"], fr: ["Chaque variable classée par son pouvoir explicatif : valeur d'information (IV) et AUC pour une cible binaire.", "IV au-dessus de 0,3 : variable forte. AUC de 0,5 : aucun pouvoir ; de 1 : séparation parfaite.", "Une variable « très forte » peut être une fuite : une information connue après coup."], en: ["Each variable ranked by explanatory power: information value (IV) and AUC for a binary target.", "IV above 0.3: strong variable. AUC 0.5: no power; 1: perfect separation.", "A very strong variable may be a leak: information only known afterwards."] },
  "Arbre de décision": { t: ["Arbre de décision", "Decision tree"], fr: ["Des règles simples qui découpent les données en groupes au taux (ou à la moyenne) très différents.", "Chaque feuille donne sa règle, son effectif et son taux. L'AUC mesure la qualité du classement.", "L'arbre est appris sur les données présentes : validez-le sur d'autres données avant de l'utiliser."], en: ["Simple rules that split the data into groups with very different rates (or means).", "Each leaf gives its rule, size and rate. AUC measures ranking quality.", "The tree is learned on the present data: validate it elsewhere before using it."] },
  "Comparer deux groupes": { t: ["Comparer deux groupes", "Compare two groups"], fr: ["Ce qui distingue deux groupes, variable par variable.", "d de Cohen : écart des moyennes en écarts-types (0,2 petit, 0,5 moyen, 0,8 grand). V de Cramér pour les qualitatives.", "Sur de gros effectifs, tout est « significatif » : lisez la taille de l'effet."], en: ["What sets two groups apart, variable by variable.", "Cohen's d: difference of means in standard deviations (0.2 small, 0.5 medium, 0.8 large). Cramér's V for categorical ones.", "With large samples everything is significant: read the effect size."] },
  "Distributions comparées": { t: ["Distributions comparées", "Compared distributions"], fr: ["La distribution de chaque variable dans les deux groupes, superposée.", "Des courbes décalées : la variable sépare les groupes. Superposées : aucune différence.", "Les histogrammes sont normalisés : comparez les formes, pas les hauteurs."], en: ["Each variable's distribution in the two groups, overlaid.", "Shifted curves: the variable separates the groups. Overlapping: no difference.", "Histograms are normalised: compare shapes, not heights."] },
  "Évolution dans le temps": { t: ["Évolution dans le temps", "Change over time"], fr: ["Effectif par période et, au choix, une moyenne ou un taux.", "Cherchez les ruptures, les tendances et les saisons.", "Une période à faible effectif donne une moyenne instable."], en: ["Count per period and, optionally, a mean or a rate.", "Look for breaks, trends and seasons.", "A period with few rows gives an unstable mean."] },
  "Trajectoire dans le plan 1·2": { t: ["Trajectoire", "Trajectory"], fr: ["Le profil moyen de chaque période placé dans le plan factoriel, relié dans l'ordre.", "Un déplacement long : la population change de profil ; une boucle : un phénomène saisonnier.", "La trajectoire suit les moyennes : la dispersion à chaque période n'apparaît pas."], en: ["The mean profile of each period placed in the factor plane, joined in order.", "A long move: the population changes profile; a loop: a seasonal pattern.", "The trajectory follows means: the spread within each period is not shown."] },
  "Composition des classes": { t: ["Composition des classes", "Cluster composition"], fr: ["La part de chaque classe, période par période.", "Une classe qui grossit révèle un profil en progression.", "Les classes ont été calculées sur toute la période."], en: ["The share of each cluster, period by period.", "A growing cluster reveals a rising profile.", "Clusters were computed over the whole period."] },
  "Profil des données": { t: ["Profil des données", "Data profile"], fr: ["Chaque colonne : type, valeurs manquantes, distribution, rôle dans l'analyse.", "Changez le rôle (active, illustrative, ignorée), transformez une variable asymétrique, choisissez le traitement des manquants.", "Une colonne mal typée (code numérique pris pour une mesure) fausse l'analyse : corrigez son type."], en: ["Each column: type, missing values, distribution, role in the analysis.", "Change the role (active, supplementary, ignored), transform a skewed variable, choose missing-value handling.", "A mistyped column (a numeric code taken as a measure) distorts the analysis: fix its type."] },
  "Qualité des données": { t: ["Qualité des données", "Data quality"], fr: ["Doublons exacts, identifiants répétés, colonnes vides ou constantes, nombres mêlés de texte, dates.", "Chaque problème propose une action : retirer les doublons, exporter les lignes, changer un type.", "Un identifiant répété n'est pas toujours une erreur (plusieurs contrats par client, par exemple)."], en: ["Exact duplicates, repeated identifiers, empty or constant columns, numbers mixed with text, dates.", "Each issue offers an action: remove duplicates, export rows, change a type.", "A repeated identifier is not always an error (several contracts per client, for example)."] },
  "Variables quantitatives": { t: ["Variables quantitatives", "Numeric variables"], fr: ["Distribution et statistiques de chaque variable numérique.", "Repérez l'asymétrie, les valeurs extrêmes et les manquants.", "Une variable très asymétrique domine l'ACP : une transformation logarithmique peut aider."], en: ["Distribution and statistics of each numeric variable.", "Spot skewness, extreme values and missing values.", "A very skewed variable dominates PCA: a log transform can help."] },
  "Variables qualitatives": { t: ["Variables qualitatives", "Categorical variables"], fr: ["Fréquence de chaque modalité.", "Les modalités rares (moins de 5 %) pèsent fortement en ACM.", "Regroupez les modalités rares avant l'ACM si elles écrasent les axes."], en: ["Frequency of each category.", "Rare categories (under 5%) weigh heavily in MCA.", "Merge rare categories before MCA if they dominate the axes."] },
  "Fréquence des modalités": { t: ["Fréquence des modalités", "Category frequencies"], fr: ["Effectif de chaque modalité.", "Comparez les parts : une modalité dominante apporte peu d'information.", "Les modalités très rares s'isolent sur les axes de l'ACM."], en: ["Count of each category.", "Compare shares: a dominant category brings little information.", "Very rare categories isolate themselves on the MCA axes."] },
  "Nouvel individu à projeter": { t: ["Simulateur", "Simulator"], fr: ["Composez un individu fictif et voyez où il se place dans l'espace factoriel.", "Faites varier une variable : le point se déplace dans la direction de sa flèche.", "Des valeurs hors de l'étendue observée donnent une position extrapolée."], en: ["Build a fictitious individual and see where it lands in the factor space.", "Vary one variable: the point moves along its arrow.", "Values outside the observed range give an extrapolated position."] },
  "Nouvelle ligne à projeter": { t: ["Simulateur", "Simulator"], fr: ["Composez une ligne fictive du tableau et voyez où elle se place.", "Son profil (répartition) compte, pas son total.", "Une ligne très différente des autres se place loin du centre."], en: ["Build a fictitious table row and see where it lands.", "Its profile (distribution) matters, not its total.", "A row very different from the others lands far from the centre."] },
  "Position sur les axes": { t: ["Position sur les axes", "Position on the axes"], fr: ["Les coordonnées du point simulé sur chaque axe, comparées à la population.", "Une barre longue : le point est typé sur cet axe.", "La position n'est fiable que si le point est bien représenté."], en: ["The simulated point's coordinates on each axis, compared with the population.", "A long bar: the point is typical on this axis.", "The position is only reliable if the point is well represented."] },
  "En bref": { t: ["En bref", "In short"], fr: ["Les conclusions principales, générées à partir des règles du cours.", "Chaque phrase renvoie à une vue : axes, variables, classes.", "Relisez-les avec votre connaissance du métier : l'outil ne connaît pas le contexte."], en: ["The main conclusions, generated from the course rules.", "Each sentence points to a view: axes, variables, clusters.", "Reread them with your domain knowledge: the tool does not know the context."] },
  "Variables · filtrage croisé": { t: ["Filtrage croisé", "Cross-filtering"], fr: ["Un histogramme par variable ; toutes les vues se recalculent sur toutes les lignes à chaque filtre.", "Glissez sur un histogramme pour garder un intervalle, cliquez une modalité. Les barres claires montrent la sélection.", "Les histogrammes sont normalisés : on compare les formes."], en: ["One histogram per variable; every view is recomputed on all rows at each filter.", "Drag on a histogram to keep a range, click a category. Light bars show the selection.", "Histograms are normalised: compare shapes."] },
  "Corrélations exactes": { t: ["Corrélations exactes", "Exact correlations"], fr: ["Corrélations calculées sur toutes les lignes complètes du fichier.", "Bleu : les variables montent ensemble. Orange : elles s'opposent.", "Avec des millions de lignes, une corrélation de 0,05 est significative mais négligeable."], en: ["Correlations computed on every complete row of the file.", "Blue: variables rise together. Orange: they move in opposite directions.", "With millions of rows, a correlation of 0.05 is significant yet negligible."] },
  "Types des colonnes": { t: ["Types des colonnes", "Column types"], fr: ["Le type retenu pour chaque colonne : nombre, modalités ou ignorée.", "Corrigez un code numérique (code postal, catégorie) en modalités, ou un identifiant pris pour un nombre.", "Changer un type relit tout le fichier."], en: ["The type kept for each column: number, categories or ignored.", "Turn a numeric code (postcode, category) into categories, or ignore an identifier taken as a number.", "Changing a type rereads the whole file."] },
  "carte": { t: ["Carte de densité", "Density map"], fr: ["Toutes les lignes projetées sur le plan factoriel et comptées par case.", "Couleur : nombre de lignes (ou modalité, moyenne, classe). Tracez un rectangle ou un lasso pour sélectionner ; le relief 3D donne la hauteur de la densité.", "L'intensité est égalisée par défaut : elle montre les formes, pas les effectifs exacts (voir la bulle au survol)."], en: ["Every row projected on the factor plane and counted per cell.", "Colour: number of rows (or category, mean, cluster). Draw a rectangle or a lasso to select; the 3D relief shows density as height.", "Intensity is equalised by default: it shows shapes, not exact counts (see the hover tooltip)."] },
};
const Help = {
  keys: Object.keys(HELP).sort((a, b) => b.length - a.length),
  titleText(h) { const n = h.firstChild; return ((n && n.nodeType === 3 ? (n.__fr ?? n.data) : h.textContent) || "").trim(); },
  keyOf(h) { if (h.dataset.helpk) return h.dataset.helpk; const t = this.titleText(h); return this.keys.find(k => HELP[k].t && (t === k || t.startsWith(k + " ") || t.startsWith(k))) || null; },
  decorate() {
    document.querySelectorAll("#panel .panel-title, #big .panel-title").forEach(h => { if (h.querySelector(".hq")) return; const k = this.keyOf(h); if (!k) return;
      h.insertAdjacentHTML("beforeend", `<button class="hq" type="button" data-help="${k}" aria-label="${I18N.lang === "en" ? "Help" : "Aide"}">?</button>`); });
  },
  show(btn) {
    const k = btn.dataset.help, H = HELP[k]; if (!H) return; this.close(); const en = I18N.lang === "en", L = en ? H.en : H.fr, lab = en ? ["What it shows", "How to read it", "Watch out"] : ["Ce que c'est", "Comment le lire", "Attention"];
    const pop = document.createElement("div"); pop.className = "helpop"; pop.setAttribute("role", "dialog"); pop.dataset.noI18n = "1";
    pop.innerHTML = `<b>${esc(H.t[en ? 1 : 0])}</b>${L.map((x, i) => `<p${i === 2 ? ' class="w"' : ""}><em>${lab[i]}</em>${esc(x)}</p>`).join("")}`;
    document.body.appendChild(pop); const r = btn.getBoundingClientRect(), w = Math.min(340, innerWidth - 24);
    pop.style.width = w + "px"; pop.style.left = clamp(r.left + r.width / 2 - w / 2, 12, innerWidth - w - 12) + "px";
    const below = r.bottom + 8 + pop.offsetHeight < innerHeight; pop.style.top = (below ? r.bottom + 8 : Math.max(8, r.top - 8 - pop.offsetHeight)) + "px";
    this.cur = pop; btn.setAttribute("aria-expanded", "true"); this.btn = btn;
  },
  close() { this.cur?.remove(); this.cur = null; this.btn?.setAttribute("aria-expanded", "false"); this.btn = null; },
  bind() {
    document.addEventListener("click", e => { const b = e.target.closest("[data-help]"); if (b) { e.preventDefault(); e.stopPropagation(); if (this.btn === b) return this.close(); return this.show(b); } if (this.cur && !e.target.closest(".helpop")) this.close(); }, true);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && this.cur) { this.close(); e.stopPropagation(); } }, true);
    addEventListener("scroll", () => this.close(), { passive: true });
    new MutationObserver(() => this.decorate()).observe(document.body, { childList: true, subtree: true });
  },
};

/* ---------------------------------------------------------------- lien de partage */
const Share = {
  pending: null,
  enc(o) { const b = new TextEncoder().encode(JSON.stringify(o)); let s = ""; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  dec(s) { try { const t = atob(s.replace(/-/g, "+").replace(/_/g, "/")), b = Uint8Array.from(t, c => c.charCodeAt(0)); return JSON.parse(new TextDecoder().decode(b)); } catch (e) { return null; } },
  // selection : suite d'intervalles « 3-7,12,20-25 »
  ranges(set) { const a = [...set].sort((x, y) => x - y), out = []; for (let i = 0; i < a.length; i++) { let j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; out.push(j > i ? `${a[i]}-${a[j]}` : `${a[i]}`); i = j; } return out.join(","); },
  unranges(s) { const out = []; for (const p of String(s || "").split(",")) { const [a, b] = p.split("-").map(Number); if (!Number.isInteger(a)) continue; for (let i = a; i <= (Number.isInteger(b) ? Math.min(b, a + 5e5) : a); i++) out.push(i); } return out; },
  round(x) { return typeof x === "number" ? +x.toPrecision(6) : x; },
  link() {
    const u = new URL(location.origin + location.pathname); let local = false, view;
    if (typeof BigUI !== "undefined" && BigUI.open_ && BigUI.s) {
      const src = BigUI.src || {}; if (src.url) u.searchParams.set("data", src.url); else local = true; u.searchParams.set("mode", "big");
      const f = BigUI.filters.map(x => x.type === "poly" ? { ...x, pts: x.pts.filter((p, i) => i % Math.ceil(x.pts.length / 150) === 0).map(p => p.map(v => this.round(v))) } : Object.fromEntries(Object.entries(x).map(([k, v]) => [k, this.round(v)])));
      view = { b: 1, src: BigUI.name, f, pl: BigUI.plane, c: BigUI.color, h: BigUI.how, v: BigUI.view, br: BigUI.brush, ty: Object.keys(BigUI.types || {}).length ? BigUI.types : undefined };
    } else if (state.res) {
      if (state.example) u.searchParams.set("ex", state.example); else if (state.dataURL) u.searchParams.set("data", state.dataURL); else local = true;
      const sel = state.sel.size ? this.ranges(state.sel) : "";
      view = { m: state.method, p: state.params, pr: state.prep, s: state.supp, e: state.enc, an: Object.keys(state.axisNames).length ? state.axisNames : undefined, t: state.tab, pn: state.plan,
        tg: state.target ? { col: state.target.col, positive: state.target.positive, depth: state.target.depth } : undefined, sel: sel && sel.length < 6000 ? sel : undefined, src: state.source, lang: I18N.lang === "en" ? "en" : undefined };
    } else return null;
    u.searchParams.set("view", this.enc(view)); return { url: u.href, local, bigSel: view.sel === undefined && state.sel.size > 0 };
  },
  async copy() {
    const L = this.link(); if (!L) return toast("Rien à partager pour l'instant.");
    let ok = false; try { await navigator.clipboard.writeText(L.url); ok = true; } catch (e) {}
    const msg = L.local ? "Lien copié. Le fichier vient de votre poste : il n'est pas dans le lien. La personne qui l'ouvre charge le même fichier et retrouve la vue." : "Lien copié : il rouvre cette vue avec ses réglages et ses filtres.";
    if (ok) toast(msg); else this.dialog(L.url, msg);
  },
  // presse-papiers indisponible (page non securisee, iframe) : le lien s'affiche, pret a copier
  dialog(url, msg) { const d = document.createElement("div"); d.className = "about-back"; d.innerHTML = `<div class="about share-d" role="dialog" aria-modal="true"><header><div><span class="eyebrow">Partager</span><h2>Lien de cette vue</h2></div><button class="ab-x" type="button" aria-label="Fermer">×</button></header><p class="ab-lead">${esc(msg)}</p><input class="share-in" readonly value="${esc(url)}"></div>`;
    document.body.appendChild(d); const i = d.querySelector("input"); i.focus(); i.select(); d.addEventListener("click", e => { if (e.target === d || e.target.closest(".ab-x")) d.remove(); }); },
  // au demarrage : ?view=... est garde, puis applique une fois les donnees chargees
  fromURL() { const v = new URLSearchParams(location.search).get("view"); this.pending = v ? this.dec(v) : null; if (this.pending?.lang === "en") I18N.set("en", true); return this.pending; },
  applyStudio() {
    const v = this.pending; if (!v || v.b || !state.table) return false;
    const cols = new Set(state.table.columns), ok = c => c === null || c === undefined || cols.has(c), p = v.p || {};
    if (!["ACP", "ACM", "AFC", "AFDM"].includes(v.m) || !(p.vars || []).every(ok) || !["ident", "color", "rowVar", "colVar"].every(k => ok(p[k]))) { toast("La vue partagée ne correspond pas à ces données : réglages ignorés."); this.pending = null; return false; }
    this.pending = null; Hist.busy = true;
    state.method = v.m; state.params = { ...defaultParams(v.m), ...p };
    if (v.pr) state.prep = { missing: v.pr.missing || "drop", tr: Object.fromEntries(Object.entries(v.pr.tr || {}).filter(([c]) => cols.has(c))) };
    if (v.s) state.supp = { quanti: (v.s.quanti || []).filter(ok), quali: (v.s.quali || []).filter(ok) };
    if (v.e) state.enc = v.e; if (v.an) state.axisNames = v.an;
    if (v.tg && cols.has(v.tg.col)) state.target = { col: v.tg.col, positive: v.tg.positive ?? null, depth: v.tg.depth || 3 };
    if (v.pn) state.plan = v.pn; if (v.t && TABS.includes(v.t)) state.tab = v.t;
    renderRail(); run("project"); Hist.busy = false; Hist.reset(); Hist.touch();
    if (v.sel && state.res) { const idx = this.unranges(v.sel).filter(i => i < state.res.n); if (idx.length) Sel.set(idx, "lien partagé"); }
    toast("Vue partagée ouverte."); return true;
  },
  async applyBig() {
    const v = this.pending; if (!v || !v.b || !BigUI.acp) return; this.pending = null;
    const wait = async f => { for (let i = 0; i < 200 && !f(); i++) await new Promise(r => setTimeout(r, 100)); };
    if (v.pl && v.pl[1] < BigUI.acp.q) BigUI.plane = v.pl; if (v.h) BigUI.how = v.h; if (v.br) BigUI.brush = v.br; if (v.v) BigUI.view = v.v;
    if (v.c) { if (v.c.mode === "class") await wait(() => BigUI.cls && !BigUI.cls.pending); BigUI.color = v.c; }
    if (v.f?.length) { if (v.f.some(f => f.type === "class")) await wait(() => BigUI.cls && !BigUI.cls.pending); BigUI.filters = v.f; await BigUI.applyFilters(); }
    BigUI.box = null; BigUI.renderToolbar(); BigUI.draw(); toast("Vue partagée ouverte.");
  },
  // fichier local : la vue attend que la personne ouvre le meme fichier
  hintLocal() { const v = this.pending; if (v && v.src) toast(`Vue partagée : ouvrez le fichier « ${v.src} » pour la retrouver.`); },
};

/* ---------------------------------------------------------------- annuler / retablir (reglages du Studio) */
const Hist = {
  undo: [], redo: [], last: null, busy: false,
  snap() { return JSON.stringify({ m: state.method, p: state.params, pr: state.prep, s: state.supp, e: state.enc, an: state.axisNames, tg: state.target ? { col: state.target.col, positive: state.target.positive, depth: state.target.depth } : null }); },
  touch() { const s = this.snap(); if (!this.busy && this.last && s !== this.last) { this.undo.push(this.last); if (this.undo.length > 80) this.undo.shift(); this.redo = []; } this.last = s; this.ui(); },
  reset() { this.undo = []; this.redo = []; this.last = null; this.ui(); },
  restore(s) {
    const o = JSON.parse(s); this.busy = true;
    state.method = o.m; state.params = o.p; state.prep = o.pr; state.supp = o.s; state.enc = o.e; state.axisNames = o.an || {}; state.target = o.tg; state.tgt = null;
    renderRail(); run("morph"); this.busy = false; this.last = s; this.ui();
  },
  doUndo() {
    if (typeof BigUI !== "undefined" && BigUI.open_) return BigUI.undo();
    const cur = this.snap(); if (this.last && cur !== this.last) { this.redo.push(cur); return this.restore(this.last); }   // reglage non abouti (erreur) : retour au dernier etat valide
    if (!this.undo.length) return toast("Rien à annuler."); this.redo.push(this.last); this.restore(this.undo.pop());
  },
  doRedo() { if (typeof BigUI !== "undefined" && BigUI.open_) return BigUI.redo(); if (!this.redo.length) return toast("Rien à rétablir."); this.undo.push(this.last); this.restore(this.redo.pop()); },
  ui() { const big = typeof BigUI !== "undefined" && BigUI.open_, u = $("#undoBtn"), r = $("#redoBtn"); if (u) u.disabled = big ? !BigUI.hist.length : !this.undo.length && !(this.last && this.snap() !== this.last); if (r) r.disabled = big ? !BigUI.fut.length : !this.redo.length; },
};

/* ---------------------------------------------------------------- export PDF (impression du rapport) */
const Pdf = {
  print(r = state.res) {
    if (!r) return; const html = reportHTML(r, true, true), f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(f); setBusy("préparation du PDF");
    const done = () => { setBusy(null); setTimeout(() => f.remove(), 1500); };
    f.onload = async () => {
      const w = f.contentWindow; try { await Promise.race([w.document.fonts?.ready, new Promise(ok => setTimeout(ok, 2500))]); } catch (e) {}
      setBusy(null); try { w.addEventListener("afterprint", done); w.focus(); w.print(); toast("Choisissez « Enregistrer au format PDF » comme imprimante."); } catch (e) { done(); saveFile(`rapport_${r.method}.html`, reportHTML(r, true)); toast("Impression indisponible ici : le rapport HTML est téléchargé (Ctrl + P pour le PDF)."); }
      setTimeout(done, 60000);
    };
    f.srcdoc = html;
  },
};

/* ---------------------------------------------------------------- version anglaise */
// traduction de l'interface par dictionnaire (textes, titres, bulles, champs) ; les phrases d'interpretation
// generees restent en francais. Le texte d'origine est garde sur chaque noeud pour revenir au francais.
const I18N = {
  lang: "fr", map: null, rx: [], cache: new Map(),
  load() { if (this.map) return; this.map = new Map(Object.entries(typeof I18N_EN === "undefined" ? {} : I18N_EN)); this.rx = typeof I18N_RX === "undefined" ? [] : I18N_RX; },
  // texte entier (espaces normalises) cherche dans le dictionnaire, puis dans les motifs ; resultats gardes en cache ; espaces de bord conserves
  tr(s) {
    const t = s.trim(); if (t.length < 2 || t.length > 400 || !/[A-Za-zÀ-ÿ]{2}/.test(t)) return null; const k = t.replace(/\s+/g, " ");
    let v = this.cache.get(k);
    if (v === undefined) { v = this.map.get(k) ?? null; if (v === null) for (const [re, rep] of this.rx) { if (re.test(k)) { v = k.replace(re, rep); break; } } if (v === k) v = null; if (this.cache.size > 20000) this.cache.clear(); this.cache.set(k, v); }
    return v === null ? null : s.slice(0, s.length - s.trimStart().length) + v + s.slice(s.trimEnd().length);
  },
  // jamais traduits : donnees (cellules, noms de colonnes et de fichiers), rapport, champs de saisie
  SK: "script,style,textarea,input,[data-no-i18n],.tbl td,#paper,#dsName,[data-var],.chip,.hn,.bgt,.cl",
  skip(el) { return !el || el.closest?.(this.SK) != null; },
  // inside : le parent a deja ete verifie, seul l'element lui-meme est teste
  node(n, inside = false) {
    if (n.nodeType === 3) { if (n.__tr !== undefined && n.data === n.__tr) return; if (!inside && this.skip(n.parentElement)) return; const t = this.tr(n.data); if (t !== null) { n.__fr = n.data; n.__tr = t; n.data = t; } return; }
    if (n.nodeType !== 1 || (inside ? n.matches(this.SK) : this.skip(n))) return;
    for (const a of ["title", "aria-label", "placeholder"]) { const v = n.getAttribute(a); if (!v) continue; const k = "__fr_" + a; if (n[k + "t"] === v) continue; const t = this.tr(v); if (t !== null) { n[k] = v; n[k + "t"] = t; n.setAttribute(a, t); } }
    for (let c = n.firstChild; c; c = c.nextSibling) this.node(c, true);
  },
  apply(root = document.body) { if (this.lang !== "en") return; this.load(); this.node(root); },
  revert(root = document.body) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (n.__fr !== undefined && n.data === n.__tr) { n.data = n.__fr; n.__fr = undefined; n.__tr = undefined; }
    root.querySelectorAll("*").forEach(el => { for (const a of ["title", "aria-label", "placeholder"]) if (el["__fr_" + a] !== undefined) { if (el.getAttribute(a) === el["__fr_" + a + "t"]) el.setAttribute(a, el["__fr_" + a]); el["__fr_" + a] = undefined; } });
  },
  set(lang, silent = false) {
    this.lang = lang === "en" ? "en" : "fr"; document.documentElement.lang = this.lang; try { localStorage.setItem("prisme-lang", this.lang); } catch (e) {}
    NUMFMT.dec = this.lang === "en" ? "." : ","; NUMFMT.pct = this.lang === "en" ? "%" : " %";
    const b = $("#langBtn"); if (b) { b.textContent = this.lang === "en" ? "FR" : "EN"; b.title = this.lang === "en" ? "Passer en français" : "Switch to English"; }
    if (silent) return;
    if (this.lang === "fr") this.revert(); if (state.res) { renderHeader(); renderKPIs(); renderRail(); renderPanel(); } if (typeof BigUI !== "undefined" && BigUI.open_ && BigUI.s) BigUI.renderDash();
    this.apply();
  },
  bind() {
    // traduit dans le rappel de l'observateur (microtache) : avant l'affichage, donc sans clignotement du francais
    new MutationObserver(recs => { if (this.lang !== "en") return; this.load(); for (const r of recs) { if (r.type === "childList") r.addedNodes.forEach(n => n.isConnected && this.node(n)); else if (r.target.isConnected) this.node(r.target); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label", "placeholder"] });
  },
};

/* ---------------------------------------------------------------- telephone : reglages en panneau, barre d'actions */
const Mobile = {
  bind() {
    document.body.insertAdjacentHTML("beforeend", `<nav class="mbar" id="mbar" aria-label="Navigation"><button type="button" data-mb="rail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg><span>Réglages</span></button><button type="button" data-mb="stage"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg><span>Vue 3D</span></button><button type="button" data-mb="tabs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg><span>Résultats</span></button><button type="button" data-mb="import"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg><span>Importer</span></button></nav><div class="rail-back" id="railBack" hidden></div>`);
    const rail = document.querySelector(".rail"); rail.insertAdjacentHTML("afterbegin", `<div class="rail-head"><b>Réglages</b><button type="button" class="rail-x" data-mb="close" aria-label="Fermer les réglages">×</button></div>`);
    const open = on => { document.body.classList.toggle("rail-open", on); $("#railBack").hidden = !on; if (on) rail.scrollTop = 0; };
    document.addEventListener("click", e => {
      const b = e.target.closest("[data-mb]"); if (b) { const a = b.dataset.mb;
        if (a === "rail") return open(!document.body.classList.contains("rail-open")); if (a === "close") return open(false);
        if (a === "import") { open(false); return $("#fileInput").click(); }
        open(false); if (typeof BigUI !== "undefined" && BigUI.open_) return $("#big").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
        return $(a === "stage" ? "#stage" : "#tabs").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); }
      if (e.target.id === "railBack") return open(false);
    });
    // un exemple choisi ou une methode changee : on referme le panneau pour voir le resultat
    // (phase de capture : le bouton d'exemple est remplace pendant le traitement du clic)
    document.addEventListener("click", e => { if (document.body.classList.contains("rail-open") && e.target.closest("#examples [data-ex], #methodSeg [data-m]")) setTimeout(() => open(false), 150); }, true);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("rail-open")) open(false); });
  },
};

/* ---------------------------------------------------------------- barres qui defilent de cote (onglets, boutons de la 3D) */
// a la souris : on attrape la barre et on la tire (un glisser n'ouvre pas l'onglet sous le curseur) ;
// au doigt et au pave tactile, le defilement natif reste ; un fondu signale le cote ou il reste des onglets
const HScroll = {
  attach(el) {
    if (!el || el.__hs) return; el.__hs = true;
    const edges = () => { const m = el.scrollWidth - el.clientWidth; el.classList.toggle("more-l", el.scrollLeft > 2); el.classList.toggle("more-r", el.scrollLeft < m - 2); };
    let st = null, moved = false;
    el.addEventListener("pointerdown", e => { moved = false; if (e.pointerType === "touch" || e.button !== 0 || el.scrollWidth <= el.clientWidth + 1) return; st = { x: e.clientX, s: el.scrollLeft, id: e.pointerId }; });
    el.addEventListener("pointermove", e => {
      if (!st) return; const dx = e.clientX - st.x; if (!moved && Math.abs(dx) < 6) return;
      if (!moved) { moved = true; el.classList.add("dragging"); try { el.setPointerCapture(st.id); } catch (err) {} }
      el.scrollLeft = st.s - dx;
    });
    const end = () => { st = null; el.classList.remove("dragging"); };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end); el.addEventListener("lostpointercapture", end);
    el.addEventListener("click", e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    el.addEventListener("dragstart", e => e.preventDefault());
    el.addEventListener("scroll", edges, { passive: true }); new ResizeObserver(edges).observe(el); edges();
  },
  // amene un element dans la partie visible de la barre (onglet choisi depuis la palette, un lien ou un raccourci)
  reveal(el, item) {
    if (!el || !item || el.scrollWidth <= el.clientWidth + 1) return; const r = item.getBoundingClientRect(), c = el.getBoundingClientRect(), pad = 40;
    if (r.left < c.left + pad) el.scrollBy({ left: r.left - c.left - pad, behavior: reduced ? "auto" : "smooth" });
    else if (r.right > c.right - pad) el.scrollBy({ left: r.right - c.right + pad, behavior: reduced ? "auto" : "smooth" });
  },
};

function bindComfort() {
  I18N.bind(); Help.bind(); Mobile.bind(); HScroll.attach($("#tabs")); HScroll.attach($("#toggles"));
  $("#undoBtn").onclick = () => Hist.doUndo(); $("#redoBtn").onclick = () => Hist.doRedo();
  $("#shareBtn").onclick = () => Share.copy(); $("#langBtn").onclick = () => I18N.set(I18N.lang === "en" ? "fr" : "en");
  const hb = document.createElement("button"); hb.className = "hq"; hb.type = "button"; hb.dataset.help = "stage"; hb.setAttribute("aria-label", "Aide"); document.querySelector(".hud-tl .eyebrow")?.appendChild(hb);
}
