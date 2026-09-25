import {
    getWorkoutExerciseSides,
    getWorkoutSeriesLog,
    hasWorkoutExerciseLogs,
    isWorkoutSetCompleted
} from "../workout/workout-session.js";

// ============================================================
// HISTORIQUE
// ============================================================

const PAGE_SIZE = 20;

let page;
let workoutList;
let workoutsContent;
let pagination;
let previousPageButton;
let nextPageButton;
let pageLabel;

let calendarTitle;
let calendarDays;
let calendarPreviousButton;
let calendarNextButton;

let selectedDayPanel;
let selectedDayTitle;
let selectedDayList;

let summaryHost;

let history = [];
let currentPage = 0;
let selectedDateKey = null;

const now = new Date();

let calendarYear = now.getFullYear();
let calendarMonth = now.getMonth();

let onOpenWorkout = async () => {};

// ============================================================
// CONFIGURATION
// ============================================================

function configureHistoryController(dependencies) {
    ({
        page,
        workoutList,
        workoutsContent,
        pagination,
        previousPageButton,
        nextPageButton,
        pageLabel,

        calendarTitle,
        calendarDays,
        calendarPreviousButton,
        calendarNextButton,

        selectedDayPanel,
        selectedDayTitle,
        selectedDayList,

        summaryHost,

        onOpenWorkout = async () => {}
    } = dependencies);
}

// ============================================================
// DATES
// ============================================================

function getDateKey(timestamp) {
    const date = new Date(timestamp);

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function formatMonthYear(year, month) {
    return new Intl.DateTimeFormat(
        "fr-CA",
        {
            month: "long",
            year: "numeric"
        }
    ).format(
        new Date(year, month, 1)
    );
}

function formatFullDate(timestamp) {
    return new Intl.DateTimeFormat(
        "fr-CA",
        {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    ).format(
        new Date(timestamp)
    );
}

function formatWorkoutDate(timestamp) {
    const date = new Date(timestamp);

    const weekday =
        new Intl.DateTimeFormat(
            "fr-CA",
            { weekday: "short" }
        )
            .format(date)
            .replace(".", "");

    return `${weekday} ${date.getDate()}`;
}

function formatDuration(totalSeconds) {
    const seconds =
        Math.max(
            0,
            Math.round(
                Number(totalSeconds) || 0
            )
        );

    const hours =
        Math.floor(seconds / 3600);

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    if (hours && minutes) {
        return `${hours} h ${minutes} min`;
    }

    if (hours) {
        return `${hours} h`;
    }

    return `${minutes} min`;
}

// ============================================================
// STATISTIQUES D'UNE SÉANCE
// ============================================================

function getExecutedExerciseCount(session) {
    const exerciseKeys = new Set();

    session.sets.forEach(set => {
        set.exercises.forEach(workoutExercise => {
            if (
                !hasWorkoutExerciseLogs(
                    workoutExercise
                )
            ) {
                return;
            }

            exerciseKeys.add(
                String(
                    workoutExercise.exercise?.ID ??
                    workoutExercise.exercise?.nom ??
                    workoutExercise.id
                )
            );
        });
    });

    return exerciseKeys.size;
}

function getExecutedSetCount(session) {
    return session.sets.filter(
        isWorkoutSetCompleted
    ).length;
}

// ============================================================
// CARTE D'ENTRAÎNEMENT
// ============================================================

function createWorkoutCard(session) {
    const button =
        document.createElement("button");

    button.type = "button";
    button.className =
        "history-workout-card";

    const primary =
        document.createElement("div");

    primary.className =
        "history-workout-primary";

    const date =
        document.createElement("span");

    date.className =
        "history-workout-date";

    date.textContent =
        formatWorkoutDate(
            session.startedAt
        );

    const name =
        document.createElement("span");

    name.className =
        "history-workout-name";

    name.textContent =
        session.planName ||
        "Entraînement";

    primary.append(
        date,
        name
    );

    const secondary =
        document.createElement("div");

    secondary.className =
        "history-workout-secondary";

    const setCount =
        getExecutedSetCount(
            session
        );

    const exerciseCount =
        getExecutedExerciseCount(
            session
        );

    secondary.textContent =
        `${formatDuration(session.elapsedSeconds)} - ` +
        `${setCount} set${setCount !== 1 ? "s" : ""} | ` +
        `${exerciseCount} exercice${exerciseCount !== 1 ? "s" : ""}`;

    button.append(
        primary,
        secondary
    );

    button.addEventListener(
        "click",
        () => {
            onOpenWorkout(session);
        }
    );

    return button;
}

// ============================================================
// CALENDRIER
// ============================================================

function getWorkoutDateKeys() {
    return new Set(
        history.map(session =>
            getDateKey(
                session.startedAt
            )
        )
    );
}

function renderCalendar() {
    calendarTitle.textContent =
        formatMonthYear(
            calendarYear,
            calendarMonth
        );

    calendarDays.replaceChildren();

    const workoutDates =
        getWorkoutDateKeys();

    const firstDay =
        new Date(
            calendarYear,
            calendarMonth,
            1
        );

    const firstWeekday =
        (firstDay.getDay() + 6) % 7;

    const dayCount =
        new Date(
            calendarYear,
            calendarMonth + 1,
            0
        ).getDate();

    for (
        let index = 0;
        index < firstWeekday;
        index += 1
    ) {
        const spacer =
            document.createElement("div");

        spacer.className =
            "history-calendar-day-spacer";

        calendarDays.appendChild(
            spacer
        );
    }

    for (
        let day = 1;
        day <= dayCount;
        day += 1
    ) {
        const date =
            new Date(
                calendarYear,
                calendarMonth,
                day
            );

        const dateKey =
            getDateKey(
                date.getTime()
            );

        const button =
            document.createElement(
                "button"
            );

        button.type = "button";
        button.className =
            "history-calendar-day";

        button.textContent =
            String(day);

        if (
            workoutDates.has(
                dateKey
            )
        ) {
            button.classList.add(
                "has-workout"
            );
        }

        if (
            dateKey ===
            selectedDateKey
        ) {
            button.classList.add(
                "is-selected"
            );
        }

        button.addEventListener(
            "click",
            () => {
                selectedDateKey =
                    dateKey;

                renderCalendar();
                renderSelectedDay();
            }
        );

        calendarDays.appendChild(
            button
        );
    }
}

function renderSelectedDay() {
    selectedDayList.replaceChildren();

    if (!selectedDateKey) {
        selectedDayTitle.textContent =
            "Sélectionnez une date";

        const empty =
            document.createElement("p");

        empty.className =
            "history-empty";

        empty.textContent =
            "Cliquez sur une date du calendrier pour voir les entraînements exécutés.";

        selectedDayList.appendChild(
            empty
        );

        return;
    }

    const workouts =
        history.filter(
            session =>
                getDateKey(
                    session.startedAt
                ) === selectedDateKey
        );

    const [
        year,
        month,
        day
    ] = selectedDateKey
        .split("-")
        .map(Number);

    selectedDayTitle.textContent =
        formatFullDate(
            new Date(
                year,
                month - 1,
                day
            ).getTime()
        );

    if (!workouts.length) {
        const empty =
            document.createElement("p");

        empty.className =
            "history-empty";

        empty.textContent =
            "Aucun entraînement exécuté cette journée.";

        selectedDayList.appendChild(
            empty
        );

        return;
    }

    workouts.forEach(session => {
        selectedDayList.appendChild(
            createWorkoutCard(
                session
            )
        );
    });
}

// ============================================================
// LISTE CHRONOLOGIQUE
// ============================================================

function getMonthKey(timestamp) {
    const date = new Date(timestamp);

    return (
        `${date.getFullYear()}-` +
        `${String(
            date.getMonth() + 1
        ).padStart(2, "0")}`
    );
}

function renderWorkoutList() {
    workoutList.replaceChildren();

    if (!history.length) {
        const empty =
            document.createElement("p");

        empty.className =
            "history-empty";

        empty.textContent =
            "Aucun entraînement n'a encore été enregistré.";

        workoutList.appendChild(
            empty
        );

        pagination.hidden = true;

        return;
    }

    const pageCount =
        Math.ceil(
            history.length /
            PAGE_SIZE
        );

    currentPage =
        Math.min(
            currentPage,
            pageCount - 1
        );

    const start =
        currentPage *
        PAGE_SIZE;

    const sessions =
        history.slice(
            start,
            start + PAGE_SIZE
        );

    let currentMonthKey = null;
    let currentMonthList = null;

    sessions.forEach(session => {
        const monthKey =
            getMonthKey(
                session.startedAt
            );

        if (
            monthKey !==
            currentMonthKey
        ) {
            currentMonthKey =
                monthKey;

            const group =
                document.createElement(
                    "section"
                );

            group.className =
                "history-month-group";

            const title =
                document.createElement(
                    "h3"
                );

            title.className =
                "history-month-title";

            const date =
                new Date(
                    session.startedAt
                );

            title.textContent =
                formatMonthYear(
                    date.getFullYear(),
                    date.getMonth()
                );

            currentMonthList =
                document.createElement(
                    "div"
                );

            currentMonthList.className =
                "history-month-list";

            group.append(
                title,
                currentMonthList
            );

            workoutList.appendChild(
                group
            );
        }

        currentMonthList.appendChild(
            createWorkoutCard(
                session
            )
        );
    });

    pagination.hidden =
        pageCount <= 1;

    pageLabel.textContent =
        `Page ${currentPage + 1} sur ${pageCount}`;

    previousPageButton.disabled =
        currentPage === 0;

    nextPageButton.disabled =
        currentPage >=
        pageCount - 1;
}

// ============================================================
// WORKOUT SUMMARY
// ============================================================

function showHistoryList() {
    workoutsContent.hidden = false;
    summaryHost.hidden = true;
}

function showHistorySummary() {
    workoutsContent.hidden = true;
    summaryHost.hidden = false;
}

function getHistorySummaryHost() {
    return summaryHost;
}

// ============================================================
// DONNÉES
// ============================================================

function setWorkoutHistory(records) {
    history =
        [...records].sort(
            (first, second) =>
                Number(
                    second.startedAt
                ) -
                Number(
                    first.startedAt
                )
        );

    currentPage = 0;

    renderCalendar();
    renderSelectedDay();
    renderWorkoutList();
}

function refreshWorkoutHistory(records) {
    history =
        [...records].sort(
            (first, second) =>
                Number(
                    second.startedAt
                ) -
                Number(
                    first.startedAt
                )
        );

    renderCalendar();
    renderSelectedDay();
    renderWorkoutList();
}

// ============================================================
// INITIALISATION
// ============================================================

function setupHistoryController() {
    calendarPreviousButton.addEventListener(
        "click",
        () => {
            calendarMonth -= 1;

            if (calendarMonth < 0) {
                calendarMonth = 11;
                calendarYear -= 1;
            }

            renderCalendar();
        }
    );

    calendarNextButton.addEventListener(
        "click",
        () => {
            calendarMonth += 1;

            if (calendarMonth > 11) {
                calendarMonth = 0;
                calendarYear += 1;
            }

            renderCalendar();
        }
    );

    previousPageButton.addEventListener(
        "click",
        () => {
            if (!currentPage) return;

            currentPage -= 1;
            renderWorkoutList();

            page.scrollIntoView({
                block: "start",
                behavior: "auto"
            });
        }
    );

    nextPageButton.addEventListener(
        "click",
        () => {
            const pageCount =
                Math.ceil(
                    history.length /
                    PAGE_SIZE
                );

            if (
                currentPage >=
                pageCount - 1
            ) {
                return;
            }

            currentPage += 1;
            renderWorkoutList();

            page.scrollIntoView({
                block: "start",
                behavior: "auto"
            });
        }
    );
}

export {
    configureHistoryController,
    setupHistoryController,
    setWorkoutHistory,
    refreshWorkoutHistory,
    showHistoryList,
    showHistorySummary,
    getHistorySummaryHost
};