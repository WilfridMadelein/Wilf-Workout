// Catalogue public : conserver les noms historiques pour les filtres et anciennes sauvegardes.
const equipmentGroups = {
    poids: ["Dumbbell", "Barbell", "Kettlebell", "Plate", "Cable", "Machine", "Élastique", "Weight vest", "Sandbag"],
    bancs: ["Banc Assis", "Banc Incliné", "Banc couché"],
    cali: ["Box", "Barre traction", "Anneaux/TRX", "Dip bar", "Parallettes"],
    extra: ["Swiss ball", "Ab roller"]
};
const equipmentOptions = Object.values(equipmentGroups).flat();
