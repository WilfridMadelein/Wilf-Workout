const exerciseList = document.getElementById("exercise-list");

exercises.forEach(exercise => {

    const exerciseElement = document.createElement("div");

    exerciseElement.textContent = exercise.nom;

    exerciseList.appendChild(exerciseElement);

});