const exerciseList = document.getElementById("exercise-list");
const searchInput = document.getElementById("search-input");
const typeButtons = document.querySelectorAll("#type-filters button");
const detailsContent = document.getElementById("details-content");

let currentType = "all";

function displayExercises() {

    const searchText = searchInput.value.toLowerCase();

    const filteredExercises = exercises.filter(exercise => {

        const matchesSearch =
            exercise.nom.toLowerCase().includes(searchText);

        const matchesType =
            currentType === "all" ||
            exercise.type === currentType;

        return matchesSearch && matchesType;

    });

    exerciseList.innerHTML = "";

    filteredExercises.forEach(exercise => {

        const element = document.createElement("div");

        element.classList.add("exercise-item");

        element.textContent = exercise.nom;

        element.addEventListener("click", () => {
            displayExerciseDetails(exercise);
        });

        exerciseList.appendChild(element);

    });
}


function displayExerciseDetails(exercise) {

    detailsContent.innerHTML = `
        <h3>${exercise.nom}</h3>

        <p><strong>Type :</strong> ${exercise.type}</p>

        <p><strong>Calisthenics :</strong> ${exercise.cali}</p>

        <p><strong>Gym :</strong> ${exercise.gym}</p>

        <p><strong>Pronation :</strong> ${exercise.pronation.join(", ")}</p>

        <p><strong>Groupe de progression :</strong> ${exercise.prog_group}</p>

        <p><strong>Ordre de progression :</strong> ${exercise.prog_ordre}</p>
    `;
}


searchInput.addEventListener("input", displayExercises);


typeButtons.forEach(button => {

    button.addEventListener("click", () => {

        currentType = button.dataset.type;

        displayExercises();

    });

});


displayExercises();