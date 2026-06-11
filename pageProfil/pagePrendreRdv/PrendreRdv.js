const DAYS_TO_SHOW = 7;
const doctorConfig = window.HANDIREPERE_DOCTOR_CONFIG || {
    defaultAppointmentDurationMinutes: 60,
    weeklyAvailabilityTemplate: {
        0: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        1: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        2: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        3: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        4: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        5: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        6: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
    },
    weeklyTimeSlots: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
};

let doctorContext = null;
let unavailableSlots = new Set();
let selectedSlotKey = "";
let slotDurationMap = createDurationMapFromTemplate(doctorConfig.weeklyAvailabilityTemplate);
let weeklyAvailabilityMap = createAvailabilityMapFromTemplate({});
let planningLoaded = false;

function getWeeklySlotKey(dayOfWeek, timeSlot) {
    return `${dayOfWeek}|${timeSlot}`;
}

function normalizeDurationMinutes(value) {
    const durationMinutes = Number(value);

    if (Number.isInteger(durationMinutes) && durationMinutes > 0) {
        return durationMinutes;
    }

    return doctorConfig.defaultAppointmentDurationMinutes;
}

function createAvailabilityMapFromTemplate(template) {
    return new Map(Array.from({ length: 7 }, (_, dayOfWeek) => {
        const availableSlots = Array.isArray(template?.[dayOfWeek]) ? template[dayOfWeek] : [];
        return [dayOfWeek, new Set(availableSlots)];
    }));
}

function createDurationMapFromTemplate(template) {
    const durationMap = new Map();

    Array.from({ length: 7 }, (_, dayOfWeek) => {
        const availableSlots = Array.isArray(template?.[dayOfWeek]) ? template[dayOfWeek] : [];

        availableSlots.forEach((timeSlot) => {
            durationMap.set(
                getWeeklySlotKey(dayOfWeek, timeSlot),
                doctorConfig.defaultAppointmentDurationMinutes
            );
        });
    });

    return durationMap;
}

function createAvailabilityMapFromResponse(weeklyAvailability) {
    const availabilityMap = createAvailabilityMapFromTemplate({});

    if (!Array.isArray(weeklyAvailability)) {
        return availabilityMap;
    }

    weeklyAvailability.forEach((slot) => {
        if (!slot || slot.isAvailable !== true) {
            return;
        }

        const daySlots = availabilityMap.get(slot.dayOfWeek) || new Set();
        daySlots.add(slot.timeSlot);
        availabilityMap.set(slot.dayOfWeek, daySlots);
    });

    return availabilityMap;
}

function createDurationMapFromResponse(weeklyAvailability) {
    const durationMap = createDurationMapFromTemplate(doctorConfig.weeklyAvailabilityTemplate);

    if (!Array.isArray(weeklyAvailability)) {
        return durationMap;
    }

    weeklyAvailability.forEach((slot) => {
        if (!slot) {
            return;
        }

        durationMap.set(
            getWeeklySlotKey(slot.dayOfWeek, slot.timeSlot),
            normalizeDurationMinutes(slot.durationMinutes)
        );
    });

    return durationMap;
}

function getApiBaseUrl() {
    return window.location.protocol === "file:" ? "http://localhost:3000" : "";
}

function parseApiResponse(responseText, fallbackMessage = "") {
    if (!responseText) {
        return fallbackMessage ? { message: fallbackMessage } : {};
    }

    const trimmedResponse = responseText.trim();

    if (!trimmedResponse || trimmedResponse.startsWith("<")) {
        return fallbackMessage ? { message: fallbackMessage } : {};
    }

    try {
        return JSON.parse(trimmedResponse);
    } catch (error) {
        console.error(error);
        return fallbackMessage ? { message: fallbackMessage } : {};
    }
}

function getSearchValue(searchParams, key, fallback = "") {
    const value = searchParams.get(key);
    return value && value.trim() ? value.trim() : fallback;
}

function getDoctorKey(searchParams) {
    const explicitDoctorKey = getSearchValue(searchParams, "doctorKey");
    const professionalEmail = getSearchValue(searchParams, "professionalEmail");

    if (explicitDoctorKey) {
        return explicitDoctorKey.toLowerCase();
    }

    if (professionalEmail) {
        return professionalEmail.toLowerCase();
    }

    return `${getSearchValue(searchParams, "fullName")}|${getSearchValue(searchParams, "region")}`.toLowerCase();
}

function formatDayLabel(date) {
    return new Intl.DateTimeFormat("fr-FR", {
        weekday: "long"
    }).format(date);
}

function formatDayDate(date) {
    return new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long"
    }).format(date);
}

function formatSelectedDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(new Date(year, month - 1, day));
}

function toDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);

    if (!year || !month || !day) {
        return null;
    }

    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    date.setHours(0, 0, 0, 0);
    return date;
}

function isPastSlot(date, time) {
    const [hours, minutes] = time.split(":").map(Number);
    const slotDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        hours,
        minutes,
        0,
        0
    );

    return slotDate.getTime() <= Date.now();
}

function getSlotsForDate(date) {
    return weeklyAvailabilityMap.get(date.getDay()) || new Set();
}

function getSlotDuration(date, timeSlot) {
    return slotDurationMap.get(getWeeklySlotKey(date.getDay(), timeSlot))
        || doctorConfig.defaultAppointmentDurationMinutes;
}

function getSlotDurationFromDateKey(dateKey, timeSlot) {
    const date = parseDateKey(dateKey);

    if (!date) {
        return doctorConfig.defaultAppointmentDurationMinutes;
    }

    return getSlotDuration(date, timeSlot);
}

function getPlanningDays() {
    return Array.from({ length: DAYS_TO_SHOW }, (_, index) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + index);
        return date;
    });
}

function updateSelectionSummary() {
    document.getElementById("summaryDoctor").textContent = doctorContext.doctorName;

    if (!selectedSlotKey) {
        document.getElementById("summaryDate").textContent = "Aucune date selectionnee";
        document.getElementById("summaryTime").textContent = "Aucun horaire selectionne";
        document.getElementById("summaryDuration").textContent = "Aucune duree selectionnee";
        document.getElementById("saveAppointmentButton").disabled = true;
        return;
    }

    const [selectedDate, selectedTime] = selectedSlotKey.split("|");
    document.getElementById("summaryDate").textContent = formatSelectedDate(selectedDate);
    document.getElementById("summaryTime").textContent = selectedTime;
    document.getElementById("summaryDuration").textContent = `${getSlotDurationFromDateKey(selectedDate, selectedTime)} minutes`;
    document.getElementById("saveAppointmentButton").disabled = false;
}

function setStatus(message, type = "") {
    const status = document.getElementById("saveStatus");
    status.textContent = message;
    status.className = type ? `saveStatus ${type}` : "saveStatus";
}

function renderPlanning() {
    const planningGrid = document.getElementById("planningGrid");
    const planningDays = getPlanningDays();

    planningGrid.innerHTML = "";
    planningGrid.style.gridTemplateColumns = `110px repeat(${planningDays.length}, minmax(140px, 1fr))`;

    const cornerCell = document.createElement("div");
    cornerCell.className = "matrixCornerCell";
    cornerCell.textContent = "Heure";
    planningGrid.appendChild(cornerCell);

    planningDays.forEach((date) => {
        const headerCell = document.createElement("div");
        headerCell.className = "matrixHeaderCell";

        const title = document.createElement("h3");
        title.textContent = formatDayLabel(date);

        const subtitle = document.createElement("p");
        subtitle.textContent = formatDayDate(date);

        headerCell.append(title, subtitle);
        planningGrid.appendChild(headerCell);
    });

    doctorConfig.weeklyTimeSlots.forEach((time) => {
        const timeCell = document.createElement("div");
        timeCell.className = "matrixTimeCell";
        timeCell.textContent = time;
        planningGrid.appendChild(timeCell);

        planningDays.forEach((date) => {
            const daySlots = getSlotsForDate(date);
            const dateKey = toDateKey(date);
            const slotKey = `${dateKey}|${time}`;
            const isTemplateAvailable = daySlots.has(time);
            const isUnavailable = !planningLoaded || !isTemplateAvailable || unavailableSlots.has(slotKey) || isPastSlot(date, time);
            const isSelected = selectedSlotKey === slotKey;
            const durationMinutes = getSlotDuration(date, time);
            const slotCell = document.createElement("div");
            slotCell.className = "matrixSlotCell";
            const slotButton = document.createElement("button");

            slotButton.type = "button";
            slotButton.className = `slotButton ${isSelected ? "selected" : (isUnavailable ? "unavailable" : "available")}`;
            slotButton.disabled = isUnavailable;
            slotButton.textContent = planningLoaded && isTemplateAvailable ? time : "—";
            slotButton.title = planningLoaded && isTemplateAvailable
                ? `${time} - ${durationMinutes} minutes`
                : `${time} - indisponible`;

            if (!isUnavailable) {
                slotButton.addEventListener("click", () => {
                    selectedSlotKey = slotKey;
                    setStatus("");
                    updateSelectionSummary();
                    renderPlanning();
                });
            }

            slotCell.appendChild(slotButton);
            planningGrid.appendChild(slotCell);
        });
    });
}

async function loadAvailability() {
    const planningStatus = document.getElementById("planningStatus");
    planningStatus.textContent = "Chargement du planning du medecin...";
    unavailableSlots = new Set();
    planningLoaded = false;
    slotDurationMap = createDurationMapFromTemplate(doctorConfig.weeklyAvailabilityTemplate);
    weeklyAvailabilityMap = createAvailabilityMapFromTemplate({});
    selectedSlotKey = "";
    updateSelectionSummary();
    renderPlanning();

    try {
        const response = await fetch(
            `${getApiBaseUrl()}/api/appointments/availability?doctorKey=${encodeURIComponent(doctorContext.doctorKey)}`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        const responseText = await response.text();
        const data = parseApiResponse(
            responseText,
            "Le backend doit etre redemarre pour charger les disponibilites enregistrees."
        );

        if (!response.ok) {
            throw new Error(data.message || "Impossible de charger le planning.");
        }

        const unavailableSlotsData = Array.isArray(data.unavailableSlots) ? data.unavailableSlots : [];

        unavailableSlots = new Set(unavailableSlotsData.map((slot) => {
            return `${slot.appointmentDate}|${slot.appointmentTime}`;
        }));
        slotDurationMap = createDurationMapFromResponse(data.weeklyAvailability);
        weeklyAvailabilityMap = createAvailabilityMapFromResponse(data.weeklyAvailability);
        planningLoaded = true;

        planningStatus.textContent = "Selectionnez un creneau disponible. La duree affichee depend du reglage du medecin.";
        renderPlanning();
    } catch (error) {
        console.error(error);
        planningLoaded = false;
        slotDurationMap = createDurationMapFromTemplate(doctorConfig.weeklyAvailabilityTemplate);
        weeklyAvailabilityMap = createAvailabilityMapFromTemplate({});
        planningStatus.textContent = "Impossible de charger le planning reel du medecin pour le moment.";
        renderPlanning();
    }
}

async function saveAppointment() {
    if (!selectedSlotKey) {
        return;
    }

    const [appointmentDate, appointmentTime] = selectedSlotKey.split("|");
    const durationMinutes = getSlotDurationFromDateKey(appointmentDate, appointmentTime);
    const saveButton = document.getElementById("saveAppointmentButton");

    saveButton.disabled = true;
    setStatus("Enregistrement du rendez-vous en cours...");

    try {
        const response = await fetch(`${getApiBaseUrl()}/api/appointments`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                doctorKey: doctorContext.doctorKey,
                doctorName: doctorContext.doctorName,
                doctorEmail: doctorContext.professionalEmail,
                doctorCabinet: doctorContext.cabinet,
                doctorCity: doctorContext.city,
                doctorRegion: doctorContext.region,
                appointmentDate,
                appointmentTime
            })
        });

        const responseText = await response.text();
        const data = parseApiResponse(
            responseText,
            "Le backend doit etre redemarre pour enregistrer le rendez-vous."
        );

        if (!response.ok) {
            throw new Error(data.message || "Impossible d'enregistrer le rendez-vous.");
        }

        setStatus(
            `Rendez-vous enregistre pour le ${formatSelectedDate(appointmentDate)} a ${appointmentTime} pour ${data.appointment?.durationMinutes || durationMinutes} minutes.`,
            "success"
        );

        selectedSlotKey = "";
        updateSelectionSummary();
        await loadAvailability();
    } catch (error) {
        console.error(error);
        setStatus(error.message || "Impossible d'enregistrer le rendez-vous.", "error");
        updateSelectionSummary();
    }
}

function hydrateDoctorSummary() {
    const summaryParts = [doctorContext.cabinet, doctorContext.address].filter(Boolean);
    const locationParts = [doctorContext.city, doctorContext.postalCode].filter(Boolean).join(" ");
    const regionParts = [locationParts, doctorContext.region].filter(Boolean);

    document.getElementById("doctorName").textContent = doctorContext.doctorName;
    document.getElementById("doctorSummary").textContent = summaryParts.join(" - ") || "Informations du cabinet non renseignees";
    document.getElementById("doctorLocation").textContent = regionParts.join(" - ") || "Localisation non renseignee";
    document.getElementById("doctorContact").textContent = doctorContext.professionalEmail || "Email professionnel non renseigne";
}

document.addEventListener("DOMContentLoaded", async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const appointmentContent = document.getElementById("appointmentContent");
    const appointmentEmptyState = document.getElementById("appointmentEmptyState");

    doctorContext = {
        doctorKey: getDoctorKey(searchParams),
        doctorName: getSearchValue(searchParams, "fullName"),
        cabinet: getSearchValue(searchParams, "cabinet"),
        professionalEmail: getSearchValue(searchParams, "professionalEmail"),
        phone: getSearchValue(searchParams, "phone"),
        address: getSearchValue(searchParams, "address"),
        city: getSearchValue(searchParams, "city"),
        postalCode: getSearchValue(searchParams, "postalCode"),
        region: getSearchValue(searchParams, "region"),
        country: getSearchValue(searchParams, "country")
    };

    if (!doctorContext.doctorName || !doctorContext.doctorKey) {
        appointmentEmptyState.hidden = false;
        return;
    }

    document.title = `${doctorContext.doctorName} - Rendez-vous`;
    hydrateDoctorSummary();
    updateSelectionSummary();
    document.getElementById("saveAppointmentButton").addEventListener("click", saveAppointment);
    appointmentContent.hidden = false;
    await loadAvailability();
});
