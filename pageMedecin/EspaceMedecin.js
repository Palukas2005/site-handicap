const doctorConfig = window.HANDIREPERE_DOCTOR_CONFIG || {
    doctorDisplayName: "Louis",
    weeklyAvailabilityTemplate: {
        0: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        1: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        2: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        3: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        4: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        5: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
        6: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
    },
    weeklyDayOrder: [1, 2, 3, 4, 5, 6, 0],
    weeklyTimeSlots: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
};

const DAY_LABELS = {
    0: "Dimanche",
    1: "Lundi",
    2: "Mardi",
    3: "Mercredi",
    4: "Jeudi",
    5: "Vendredi",
    6: "Samedi"
};

let doctorProfile = null;
let selectedSlotKey = "";
let weeklyAvailabilityMap = createAvailabilityMapFromTemplate(
    doctorConfig.weeklyAvailabilityTemplate
);

function createAvailabilityMapFromTemplate(template) {
    return new Map(Array.from({ length: 7 }, (_, dayOfWeek) => {
        const availableSlots = Array.isArray(template?.[dayOfWeek]) ? template[dayOfWeek] : [];
        return [dayOfWeek, new Set(availableSlots)];
    }));
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

function getDoctorApiBaseUrl() {
    return window.location.protocol === "file:" ? "http://localhost:3000" : "";
}

function parseDoctorSpaceResponse(responseText) {
    if (!responseText) {
        return {};
    }

    const trimmedResponse = responseText.trim();

    if (!trimmedResponse || trimmedResponse.startsWith("<")) {
        return {};
    }

    try {
        return JSON.parse(trimmedResponse);
    } catch (error) {
        console.error(error);
        return {};
    }
}

function getDisplayValue(value, fallback = "Information non renseignee") {
    return value || fallback;
}

function getSlotKey(dayOfWeek, timeSlot) {
    return `${dayOfWeek}|${timeSlot}`;
}

function parseSlotKey(slotKey) {
    const [dayOfWeek, timeSlot] = slotKey.split("|");
    return {
        dayOfWeek: Number(dayOfWeek),
        timeSlot
    };
}

function isSlotAvailable(dayOfWeek, timeSlot) {
    const daySlots = weeklyAvailabilityMap.get(dayOfWeek) || new Set();
    return daySlots.has(timeSlot);
}

function setSlotAvailability(dayOfWeek, timeSlot, isAvailable) {
    const daySlots = new Set(weeklyAvailabilityMap.get(dayOfWeek) || []);

    if (isAvailable) {
        daySlots.add(timeSlot);
    } else {
        daySlots.delete(timeSlot);
    }

    weeklyAvailabilityMap.set(dayOfWeek, daySlots);
}

function setActionStatus(message, type = "") {
    const status = document.getElementById("slotActionStatus");
    status.textContent = message;
    status.className = type ? `doctorActionStatus ${type}` : "doctorActionStatus";
}

function updateSelectedSlotCard() {
    const toggleButton = document.getElementById("toggleAvailabilityButton");

    if (!selectedSlotKey) {
        document.getElementById("selectedDay").textContent = "Aucune selection";
        document.getElementById("selectedTime").textContent = "Aucun horaire selectionne";
        toggleButton.disabled = true;
        toggleButton.textContent = "Selectionnez un creneau";
        return;
    }

    const { dayOfWeek, timeSlot } = parseSlotKey(selectedSlotKey);
    const slotIsAvailable = isSlotAvailable(dayOfWeek, timeSlot);

    document.getElementById("selectedDay").textContent = DAY_LABELS[dayOfWeek];
    document.getElementById("selectedTime").textContent = timeSlot;
    toggleButton.disabled = false;
    toggleButton.textContent = slotIsAvailable ? "Rendre indisponible" : "Rendre disponible";
}

function hydrateDoctorProfile() {
    const displayName = doctorProfile.displayName || doctorConfig.doctorDisplayName;
    const headerMetaParts = [
        doctorProfile.email,
        doctorProfile.cabinetName,
        doctorProfile.specialty
    ].filter(Boolean);

    document.getElementById("doctorDisplayName").textContent = displayName;
    document.getElementById("doctorHeaderMeta").textContent = headerMetaParts.join(" - ") || "Votre planning professionnel est pret a etre gere.";
    document.getElementById("doctorFullName").textContent = getDisplayValue(doctorProfile.fullName, displayName);
    document.getElementById("doctorEmail").textContent = getDisplayValue(doctorProfile.email);
    document.getElementById("doctorSpecialty").textContent = getDisplayValue(doctorProfile.specialty);
    document.getElementById("doctorCabinet").textContent = getDisplayValue(doctorProfile.cabinetName);
}

function renderPlanning() {
    const planningGrid = document.getElementById("planningGrid");

    planningGrid.innerHTML = "";
    planningGrid.style.gridTemplateColumns = `110px repeat(${doctorConfig.weeklyDayOrder.length}, minmax(120px, 1fr))`;

    const cornerCell = document.createElement("div");
    cornerCell.className = "matrixCornerCell";
    cornerCell.textContent = "Heure";
    planningGrid.appendChild(cornerCell);

    doctorConfig.weeklyDayOrder.forEach((dayOfWeek) => {
        const headerCell = document.createElement("div");
        headerCell.className = "matrixHeaderCell";

        const title = document.createElement("h3");
        title.textContent = DAY_LABELS[dayOfWeek];

        headerCell.appendChild(title);
        planningGrid.appendChild(headerCell);
    });

    doctorConfig.weeklyTimeSlots.forEach((timeSlot) => {
        const timeCell = document.createElement("div");
        timeCell.className = "matrixTimeCell";
        timeCell.textContent = timeSlot;
        planningGrid.appendChild(timeCell);

        doctorConfig.weeklyDayOrder.forEach((dayOfWeek) => {
            const slotKey = getSlotKey(dayOfWeek, timeSlot);
            const slotCell = document.createElement("div");
            slotCell.className = "matrixSlotCell";
            const slotButton = document.createElement("button");
            const slotIsAvailable = isSlotAvailable(dayOfWeek, timeSlot);
            const isSelected = selectedSlotKey === slotKey;

            slotButton.type = "button";
            slotButton.className = `slotButton ${isSelected ? "selected" : (slotIsAvailable ? "available" : "unavailable")}`;
            slotButton.textContent = timeSlot;
            slotButton.addEventListener("click", () => {
                selectedSlotKey = slotKey;
                setActionStatus("");
                updateSelectedSlotCard();
                renderPlanning();
            });

            slotCell.appendChild(slotButton);
            planningGrid.appendChild(slotCell);
        });
    });
}

async function loadDoctorSpace() {
    const doctorStatusCard = document.getElementById("doctorStatusCard");
    const doctorContent = document.getElementById("doctorContent");

    try {
        const [profileResponse, availabilityResponse] = await Promise.all([
            fetch(`${getDoctorApiBaseUrl()}/api/doctors/me`, {
                method: "GET",
                credentials: "include"
            }),
            fetch(`${getDoctorApiBaseUrl()}/api/doctors/availability`, {
                method: "GET",
                credentials: "include"
            })
        ]);

        const profileText = await profileResponse.text();
        const availabilityText = await availabilityResponse.text();
        const profileData = parseDoctorSpaceResponse(profileText);
        const availabilityData = parseDoctorSpaceResponse(availabilityText);

        if (!profileResponse.ok) {
            throw new Error(profileData.message || "Impossible de charger le profil medecin.");
        }

        if (!availabilityResponse.ok) {
            throw new Error(availabilityData.message || "Impossible de charger le planning medecin.");
        }

        doctorProfile = profileData.doctor || {};
        weeklyAvailabilityMap = createAvailabilityMapFromResponse(availabilityData.weeklyAvailability);

        hydrateDoctorProfile();
        updateSelectedSlotCard();
        renderPlanning();

        document.getElementById("planningStatus").textContent = "Selectionnez un creneau pour le rendre disponible ou indisponible.";
        doctorStatusCard.hidden = true;
        doctorContent.hidden = false;
    } catch (error) {
        console.error(error);
        doctorStatusCard.textContent = error.message || "Impossible de charger l'espace medecin.";
    }
}

async function saveSelectedSlotAvailability() {
    if (!selectedSlotKey) {
        return;
    }

    const { dayOfWeek, timeSlot } = parseSlotKey(selectedSlotKey);
    const nextAvailabilityState = !isSlotAvailable(dayOfWeek, timeSlot);
    const toggleButton = document.getElementById("toggleAvailabilityButton");

    toggleButton.disabled = true;
    setActionStatus("Mise a jour du creneau en cours...");

    try {
        const response = await fetch(`${getDoctorApiBaseUrl()}/api/doctors/availability`, {
            method: "PUT",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                dayOfWeek,
                isAvailable: nextAvailabilityState,
                timeSlot
            })
        });

        const responseText = await response.text();
        const data = parseDoctorSpaceResponse(responseText);

        if (!response.ok) {
            throw new Error(data.message || "Impossible de mettre a jour ce creneau.");
        }

        setSlotAvailability(dayOfWeek, timeSlot, nextAvailabilityState);
        selectedSlotKey = "";
        updateSelectedSlotCard();
        renderPlanning();
        setActionStatus("Planning mis a jour avec succes.", "success");
    } catch (error) {
        console.error(error);
        setActionStatus(error.message || "Impossible de mettre a jour ce creneau.", "error");
        updateSelectedSlotCard();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("toggleAvailabilityButton").addEventListener("click", saveSelectedSlotAvailability);
    loadDoctorSpace();
});
