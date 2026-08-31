const exerciseList = document.getElementById("exercise-list");
const searchInput = document.getElementById("search-input");

const typeFilters = document.getElementById("type-filters");
const muscleFilters = document.getElementById("muscle-filters");
const submuscleFilters = document.getElementById("submuscle-filters");
const equipmentFilters = document.getElementById("equipment-filters");
const categoryFilters = document.getElementById("category-filters");

const detailsContent = document.getElementById("details-content");


/* ========================================
   ÉTAT DES FILTRES
======================================== */

// TYPES
const selectedTypes = new Set();


// MUSCLES
// Au départ : toutes les familles sont disponibles,
// mais aucune famille n'est filtrée.
const selectedMuscleFamilies = new Set();


// Sous-muscles sélectionnés pour chaque famille
const selectedSubmuscles = new Map();


// ÉQUIPEMENTS
// Tous sélectionnés au départ
const selectedEquipment = new Set(
    equipmentOptions
);


// CATÉGORIES
// Cali et Gym sélectionnés au départ
const selectedCategories = new Set([
    "cali",
    "gym"
]);


/* ========================================
   CRÉATION DES BOUTONS MUSCLES
======================================== */

function createMuscleButtons() {

    // Bouton TOUS
    const allButton = document.createElement("button");

    allButton.classList.add(
        "filter-button",
        "active"
    );

    allButton.textContent = "Tous";

    allButton.dataset.muscle = "all";


    allButton.addEventListener("click", () => {

    selectedMuscleFamilies.clear();

    selectedSubmuscles.clear();

    document
        .querySelectorAll("#muscle-filters .filter-button")
        .forEach(button => {

            button.classList.remove("active");

        });


    allButton.classList.add("active");

    submuscleFilters.innerHTML = "";

    displayExercises();

});


    muscleFilters.appendChild(allButton);



    // Familles musculaires
    muscleFamilies.forEach(family => {

        const button = document.createElement("button");

        button.classList.add("filter-button");

        button.textContent = family;

        button.dataset.muscle = family;


        button.addEventListener("click", () => {

            // Si la famille est déjà sélectionnée
            if (selectedMuscleFamilies.has(family)) {

                selectedMuscleFamilies.delete(family);

                selectedSubmuscles.delete(family);

                button.classList.remove("active");

                removeSubmuscleContainer(family);

            }

            // Sinon, on l'ajoute
            else {

                selectedMuscleFamilies.add(family);

                button.classList.add("active");

                createSubmuscleButtons(family);

            }


            updateMuscleSpecialButtons();

            displayExercises();

        });


        muscleFilters.appendChild(button);

    });

}


/* ========================================
   BOUTONS TOUS / AUCUN — MUSCLES
======================================== */

function updateMuscleSpecialButtons() {

    const allButton =
        muscleFilters.querySelector(
            '[data-muscle="all"]'
        );


    // "Tous" est actif lorsqu'aucune famille
    // n'est sélectionnée.
    const allSelected =
        selectedMuscleFamilies.size === 0;


    allButton.classList.toggle(
        "active",
        allSelected
    );

}

/* ========================================
   SOUS-MUSCLES
======================================== */

function createSubmuscleButtons(family) {

    removeSubmuscleContainer(family);


    const submuscles = new Set();


    exercises.forEach(exercise => {

        const allMuscles = [
            ...exercise.muscles_principaux,
            ...exercise.muscles_secondaires
        ];


        allMuscles.forEach(muscle => {

            if (
                muscle[0] === family &&
                muscle[1] !== ""
            ) {

                submuscles.add(muscle[1]);

            }

        });

    });


    // Aucun sous-muscle trouvé
    if (submuscles.size === 0) {
        return;
    }


    // Tous les sous-muscles sélectionnés
    selectedSubmuscles.set(
        family,
        new Set(submuscles)
    );


    const container = document.createElement("div");

    container.classList.add(
        "submuscle-container"
    );

    container.dataset.family = family;


    const title = document.createElement("p");

    title.classList.add(
        "submuscle-title"
    );

    title.innerHTML =
        "<strong>" + family + "</strong>";


    container.appendChild(title);


    submuscles.forEach(submuscle => {

        const label = document.createElement("label");

        label.classList.add(
            "submuscle-option"
        );


        const checkbox =
            document.createElement("input");

        checkbox.type = "checkbox";

        checkbox.checked = true;


        checkbox.addEventListener(
            "change",
            () => {

                const selected =
                    selectedSubmuscles.get(family);


                if (checkbox.checked) {

                    selected.add(submuscle);

                }

                else {

                    selected.delete(submuscle);

                }


                displayExercises();

            }
        );


        label.appendChild(checkbox);

        label.appendChild(
            document.createTextNode(submuscle)
        );


        container.appendChild(label);

    });


    submuscleFilters.appendChild(container);

}


/* ========================================
   SUPPRIMER UNE LISTE DE SOUS-MUSCLES
======================================== */

function removeSubmuscleContainer(family) {

    const container =
        submuscleFilters.querySelector(
            `[data-family="${family}"]`
        );


    if (container) {

        container.remove();

    }

}


/* ========================================
   ÉQUIPEMENTS
======================================== */

function createEquipmentButtons() {

    equipmentOptions.forEach(equipment => {

        const button =
            document.createElement("button");


        button.classList.add(
            "filter-button",
            "active"
        );


        button.textContent = equipment;

        button.dataset.equipment =
            equipment;


        button.addEventListener(
            "click",
            () => {

                if (
                    selectedEquipment.has(
                        equipment
                    )
                ) {

                    selectedEquipment.delete(
                        equipment
                    );

                    button.classList.remove(
                        "active"
                    );

                }

                else {

                    selectedEquipment.add(
                        equipment
                    );

                    button.classList.add(
                        "active"
                    );

                }


                updateEquipmentAllButton();

                displayExercises();

            }
        );


        equipmentFilters.appendChild(
            button
        );

    });


    updateEquipmentAllButton();

}


/* ========================================
   ÉQUIPEMENT — TOUS
======================================== */

function updateEquipmentAllButton() {

    const allButton =
        equipmentFilters.querySelector(
            '[data-equipment="all"]'
        );

    const noneButton =
        equipmentFilters.querySelector(
            '[data-equipment="none"]'
        );


    const allSelected =
        selectedEquipment.size ===
        equipmentOptions.length;


    const noneSelected =
        selectedEquipment.size === 0;


    allButton.classList.toggle(
        "active",
        allSelected
    );


    noneButton.classList.toggle(
        "active",
        noneSelected
    );

}


/* ========================================
   ÉQUIPEMENT — CLIQUER SUR TOUS
======================================== */

function setupEquipmentAllButton() {

    const allButton =
        equipmentFilters.querySelector(
            '[data-equipment="all"]'
        );


    const noneButton =
        equipmentFilters.querySelector(
            '[data-equipment="none"]'
        );


    // TOUS
   allButton.addEventListener(
    "click",
    () => {

        equipmentOptions.forEach(
            equipment => {

                selectedEquipment.add(
                    equipment
                );

            }
        );


        equipmentFilters
            .querySelectorAll(
                ".filter-button"
            )
            .forEach(button => {

                button.classList.add(
                    "active"
                );

            });


        displayExercises();

    }
);

    // AUCUN
    noneButton.addEventListener(
        "click",
        () => {

            selectedEquipment.clear();


            equipmentFilters
                .querySelectorAll(
                    ".filter-button"
                )
                .forEach(button => {

                    button.classList.remove(
                        "active"
                    );

                });


            noneButton.classList.add(
                "active"
            );


            displayExercises();

        }
    );

}

/* ========================================
   TYPES
======================================== */

function setupTypeButtons() {

    const buttons =
        typeFilters.querySelectorAll(
            ".filter-button"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const type =
                    button.dataset.type;


                // TOUS
                if (type === "all") {

    selectedTypes.clear();


    buttons.forEach(
        otherButton => {

            otherButton.classList.remove(
                "active"
            );

        }
    );


    button.classList.add(
        "active"
    );

}


                // TYPE INDIVIDUEL
                else {

                    if (
                        selectedTypes.has(type)
                    ) {

                        selectedTypes.delete(type);

                        button.classList.remove(
                            "active"
                        );

                    }

                    else {

                        selectedTypes.add(type);

                        button.classList.add(
                            "active"
                        );

                    }


                    updateTypeAllButton();

                }


                displayExercises();

            }
        );

    });

}


/* ========================================
   TYPE — TOUS
======================================== */

function updateTypeAllButton() {

    const allButton =
        typeFilters.querySelector(
            '[data-type="all"]'
        );


    const allSelected =
        selectedTypes.size === 0;


    allButton.classList.toggle(
        "active",
        allSelected
    );

}


/* ========================================
   CATÉGORIES
======================================== */

function setupCategoryButtons() {

    const buttons =
        categoryFilters.querySelectorAll(
            ".filter-button"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const category =
                    button.dataset.category;


                if (
                    selectedCategories.has(
                        category
                    )
                ) {

                    selectedCategories.delete(
                        category
                    );

                    button.classList.remove(
                        "active"
                    );

                }

                else {

                    selectedCategories.add(
                        category
                    );

                    button.classList.add(
                        "active"
                    );

                }


                displayExercises();

            }
        );

    });

}


/* ========================================
   LOGIQUE ÉQUIPEMENT
======================================== */

function exerciseHasRequiredEquipment(
    exercise
) {

    /*
        Chaque sous-tableau = OU

        Chaque sous-tableau entre eux = ET

        Exemple :

        [
            ["Dumbbell", "Barbel"],
            ["Box"]
        ]

        signifie :

        (Dumbbell OU Barbel)
        ET
        (Box)
    */


    return exercise.equipement.every(
        equipmentGroup => {

            return equipmentGroup.some(
                equipment => {

                    // Aucun est toujours disponible
                    if (
                        equipment === "Aucun"
                    ) {

                        return true;

                    }


                    // Au moins une option du groupe
                    // doit être disponible
                    return selectedEquipment.has(
                        equipment
                    );

                }
            );

        }
    );

}


/* ========================================
   LOGIQUE MUSCLE
======================================== */

function exerciseMatchesMuscle(
    exercise
) {

    // Aucun filtre de famille
    if (
        selectedMuscleFamilies.size === 0
    ) {

        return true;

    }


    const allMuscles = [

        ...exercise.muscles_principaux,
        ...exercise.muscles_secondaires

    ];


    /*
        L'exercice doit appartenir à AU MOINS
        UNE des familles sélectionnées.

        Quadriceps OU Fessier
    */

    return [...selectedMuscleFamilies]
        .some(family => {

            const familyMuscles =
                allMuscles.filter(
                    muscle =>
                        muscle[0] === family
                );


            if (familyMuscles.length === 0) {
                return false;
            }


            /*
                Si la famille possède des sous-muscles
                sélectionnés, l'exercice doit correspondre
                à au moins un d'entre eux.
            */

            const selectedSubs =
                selectedSubmuscles.get(family);


            // Aucun sous-muscle identifié
            if (
                !selectedSubs ||
                selectedSubs.size === 0
            ) {

                return false;

            }


            return familyMuscles.some(
                muscle =>
                    selectedSubs.has(
                        muscle[1]
                    )
            );

        });

}


/* ========================================
   AFFICHER LES EXERCICES
======================================== */

function displayExercises() {

    const searchText =
        searchInput.value.toLowerCase();


    const filteredExercises =
        exercises.filter(exercise => {


            // Recherche
            if (
                !exercise.nom
                    .toLowerCase()
                    .includes(searchText)
            ) {

                return false;

            }


            // Type
// Si aucun type n'est sélectionné,
// cela signifie "Tous".
if (
    selectedTypes.size > 0 &&
    !selectedTypes.has(exercise.type)
) {

    return false;

}


            // Catégorie
            const matchesCategory =

                (
                    selectedCategories.has(
                        "cali"
                    ) &&
                    exercise.cali
                )

                ||

                (
                    selectedCategories.has(
                        "gym"
                    ) &&
                    exercise.gym
                );


            if (!matchesCategory) {
                return false;
            }


            // Muscle
            if (
                !exerciseMatchesMuscle(
                    exercise
                )
            ) {

                return false;

            }


            // Équipement
            if (
                !exerciseHasRequiredEquipment(
                    exercise
                )
            ) {

                return false;

            }


            return true;

        });


    exerciseList.innerHTML = "";


    filteredExercises.forEach(
        exercise => {

            const element =
                document.createElement(
                    "div"
                );


            element.classList.add(
                "exercise-item"
            );


            element.textContent =
                exercise.nom;


            element.addEventListener(
                "click",
                () => {

                    displayExerciseDetails(
                        exercise
                    );

                }
            );


            exerciseList.appendChild(
                element
            );

        }
    );

}


/* ========================================
   DÉTAILS
======================================== */

function displayExerciseDetails(
    exercise
) {

    const musclesPrincipaux =
        exercise.muscles_principaux
            .map(muscle => {

                return `
                    <li>
                        ${muscle
                            .filter(
                                part =>
                                    part !== ""
                            )
                            .join(" — ")}
                    </li>
                `;

            })
            .join("");


    const musclesSecondaires =
        exercise.muscles_secondaires
            .map(muscle => {

                return `
                    <li>
                        ${muscle
                            .filter(
                                part =>
                                    part !== ""
                            )
                            .join(" — ")}
                    </li>
                `;

            })
            .join("");


    const equipements =
        exercise.equipement
            .map(group => {

                return `
                    <li>
                        ${group.join(
                            " OU "
                        )}
                    </li>
                `;

            })
            .join("");


    detailsContent.innerHTML = `

        <h3>${exercise.nom}</h3>

        <p>
            <strong>Type :</strong>
            ${exercise.type}
        </p>

        <p>
            <strong>Cali :</strong>
            ${exercise.cali ? "Oui" : "Non"}
        </p>

        <p>
            <strong>Gym :</strong>
            ${exercise.gym ? "Oui" : "Non"}
        </p>

        <p>
            <strong>Pronation :</strong>
            ${exercise.pronation.join(", ")}
        </p>

        <p>
            <strong>Progression :</strong>
            ${exercise.prog_group}
            ${exercise.prog_ordre}
        </p>

        <h4>Équipement</h4>

        <ul>
            ${equipements}
        </ul>

        <h4>Muscles principaux</h4>

        <ul>
            ${musclesPrincipaux}
        </ul>

        <h4>Muscles secondaires</h4>

        <ul>
            ${musclesSecondaires}
        </ul>

    `;

}


/* ========================================
   RECHERCHE
======================================== */

searchInput.addEventListener(
    "input",
    displayExercises
);


/* ========================================
   INITIALISATION
======================================== */

createMuscleButtons();

createEquipmentButtons();

setupEquipmentAllButton();

setupTypeButtons();

setupCategoryButtons();

displayExercises();