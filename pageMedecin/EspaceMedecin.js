const DAYS_TO_SHOW = 7;
const doctorConfig = window.HANDIREPERE_DOCTOR_CONFIG || {
    appointmentDurationOptions: [30, 45, 60],
    defaultAppointmentDurationMinutes: 60,
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
    weeklyTimeSlots: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
};

let doctorProfile = null;
let selectedSlotKey = "";
let bookedAppointmentsMap = new Map();
let slotDurationMap = createDurationMapFromTemplate(
    doctorConfig.weeklyAvailabilityTemplate
);
let weeklyAvailabilityMap = createAvailabilityMapFromTemplate(
    doctorConfig.weeklyAvailabilityTemplate
);

function getWeeklySlotKey(dayOfWeek, timeSlot) {
    return `${dayOfWeek}|${timeSlot}`;
}

function normalizeDurationMinutes(value) {
    const durationMinutes = Number(value);

    if (doctorConfig.appointmentDurationOptions.includes(durationMinutes)) {
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

function formatSelectedDate(dateKey) {
    const date = parseDateKey(dateKey);

    if (!date) {
        return dateKey;
    }

    return new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(date);
}

function toDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getPlanningDays() {
    return Array.from({ length: DAYS_TO_SHOW }, (_, index) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + index);
        return date;
    });
}

function getSlotKey(dateKey, timeSlot) {
    return `${dateKey}|${timeSlot}`;
}

function parseSlotKey(slotKey) {
    const [dateKey, timeSlot] = slotKey.split("|");
    return {
        dateKey,
        timeSlot
    };
}

function getDayOfWeekFromDateKey(dateKey) {
    const date = parseDateKey(dateKey);
    return date ? date.getDay() : null;
}

function isTemplateSlotAvailable(dateKey, timeSlot) {
    const dayOfWeek = getDayOfWeekFromDateKey(dateKey);
    const daySlots = weeklyAvailabilityMap.get(dayOfWeek) || new Set();
    return daySlots.has(timeSlot);
}

function getTemplateSlotDuration(dateKey, timeSlot) {
    const dayOfWeek = getDayOfWeekFromDateKey(dateKey);

    if (dayOfWeek === null) {
        return doctorConfig.defaultAppointmentDurationMinutes;
    }

    return slotDurationMap.get(getWeeklySlotKey(dayOfWeek, timeSlot))
        || doctorConfig.defaultAppointmentDurationMinutes;
}

function getBookedAppointment(dateKey, timeSlot) {
    return bookedAppointmentsMap.get(getSlotKey(dateKey, timeSlot)) || null;
}

function isSlotBooked(dateKey, timeSlot) {
    return getBookedAppointment(dateKey, timeSlot) !== null;
}

function isPastSlot(dateKey, timeSlot) {
    const date = parseDateKey(dateKey);

    if (!date) {
        return false;
    }

    const [hours, minutes] = timeSlot.split(":").map(Number);
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

function setSlotAvailability(dayOfWeek, timeSlot, isAvailable) {
    const daySlots = new Set(weeklyAvailabilityMap.get(dayOfWeek) || []);

    if (isAvailable) {
        daySlots.add(timeSlot);
    } else {
        daySlots.delete(timeSlot);
    }

    weeklyAvailabilityMap.set(dayOfWeek, daySlots);
}

function setSlotDuration(dayOfWeek, timeSlot, durationMinutes) {
    slotDurationMap.set(
        getWeeklySlotKey(dayOfWeek, timeSlot),
        normalizeDurationMinutes(durationMinutes)
    );
}

function setActionStatus(message, type = "") {
    const status = document.getElementById("slotActionStatus");
    status.textContent = message;
    status.className = type ? `doctorActionStatus ${type}` : "doctorActionStatus";
}

function setBookedAppointmentStatus(message, type = "") {
    const status = document.getElementById("bookedAppointmentStatus");
    status.textContent = message;
    status.className = type ? `doctorActionStatus ${type}` : "doctorActionStatus";
}

function hydrateDurationOptions() {
    const durationSelect = document.getElementById("selectedDuration");
    const bookedDurationSelect = document.getElementById("bookedDuration");

    const optionsMarkup = doctorConfig.appointmentDurationOptions.map((durationMinutes) => {
        return `
            <option value="${durationMinutes}">${durationMinutes} minutes</option>
        `;
    }).join("");

    durationSelect.innerHTML = optionsMarkup;
    bookedDurationSelect.innerHTML = optionsMarkup;
}

function showAvailableSlotPanel() {
    document.getElementById("availableSlotPanel").hidden = false;
    document.getElementById("bookedAppointmentPanel").hidden = true;
    document.getElementById("selectionCardTitle").textContent = "Creneau selectionne";
    document.getElementById("selectionCardText").textContent = "Choisissez un creneau dans le tableau pour mettre a jour votre disponibilite.";
}

function showBookedAppointmentPanel() {
    document.getElementById("availableSlotPanel").hidden = true;
    document.getElementById("bookedAppointmentPanel").hidden = false;
    document.getElementById("selectionCardTitle").textContent = "Rendez-vous reserve";
    document.getElementById("selectionCardText").textContent = "Ce panneau remplace celui du creneau libre uniquement lorsque vous cliquez sur une case rouge reservee.";
}

function updateSelectedSlotCard() {
    const availabilitySelect = document.getElementById("selectedAvailability");
    const bookedDurationSelect = document.getElementById("bookedDuration");
    const durationSelect = document.getElementById("selectedDuration");
    const saveBookedDurationButton = document.getElementById("saveBookedDurationButton");
    const toggleButton = document.getElementById("toggleAvailabilityButton");

    if (!selectedSlotKey) {
        showAvailableSlotPanel();
        document.getElementById("selectedDay").textContent = "Aucune selection";
        document.getElementById("selectedTime").textContent = "Aucun horaire selectionne";
        availabilitySelect.disabled = true;
        availabilitySelect.value = "available";
        durationSelect.disabled = true;
        durationSelect.value = String(doctorConfig.defaultAppointmentDurationMinutes);
        bookedDurationSelect.disabled = true;
        bookedDurationSelect.value = String(doctorConfig.defaultAppointmentDurationMinutes);
        saveBookedDurationButton.disabled = true;
        toggleButton.disabled = true;
        toggleButton.textContent = "Selectionnez un creneau";
        setActionStatus("");
        setBookedAppointmentStatus("");
        return;
    }

    const { dateKey, timeSlot } = parseSlotKey(selectedSlotKey);
    const bookedAppointment = getBookedAppointment(dateKey, timeSlot);
    const slotIsBooked = Boolean(bookedAppointment);
    const slotIsAvailable = isTemplateSlotAvailable(dateKey, timeSlot);
    const durationMinutes = getTemplateSlotDuration(dateKey, timeSlot);

    if (slotIsBooked) {
        showBookedAppointmentPanel();
        document.getElementById("bookedPatientEmail").textContent = bookedAppointment.patientEmail || "Patient non renseigne";
        document.getElementById("bookedAppointmentDate").textContent = formatSelectedDate(dateKey);
        document.getElementById("bookedAppointmentTime").textContent = timeSlot;
        bookedDurationSelect.disabled = false;
        bookedDurationSelect.value = String(normalizeDurationMinutes(bookedAppointment.durationMinutes));
        saveBookedDurationButton.disabled = false;
        setActionStatus("");
        return;
    }

    showAvailableSlotPanel();
    document.getElementById("selectedDay").textContent = formatSelectedDate(dateKey);
    document.getElementById("selectedTime").textContent = timeSlot;
    availabilitySelect.disabled = slotIsBooked;
    availabilitySelect.value = slotIsAvailable ? "available" : "unavailable";
    durationSelect.disabled = slotIsBooked;
    durationSelect.value = String(durationMinutes);

    toggleButton.disabled = false;
    toggleButton.textContent = "Enregistrer les modifications";
    setBookedAppointmentStatus("");
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

    doctorConfig.weeklyTimeSlots.forEach((timeSlot) => {
        const timeCell = document.createElement("div");
        timeCell.className = "matrixTimeCell";
        timeCell.textContent = timeSlot;
        planningGrid.appendChild(timeCell);

        planningDays.forEach((date) => {
            const dateKey = toDateKey(date);
            const slotKey = getSlotKey(dateKey, timeSlot);
            const slotCell = document.createElement("div");
            slotCell.className = "matrixSlotCell";
            const slotButton = document.createElement("button");
            const bookedAppointment = getBookedAppointment(dateKey, timeSlot);
            const slotIsBooked = Boolean(bookedAppointment);
            const slotIsAvailable = isTemplateSlotAvailable(dateKey, timeSlot);
            const slotIsPast = isPastSlot(dateKey, timeSlot);
            const durationMinutes = slotIsBooked
                ? normalizeDurationMinutes(bookedAppointment.durationMinutes)
                : getTemplateSlotDuration(dateKey, timeSlot);
            const isSelected = selectedSlotKey === slotKey;
            const canSelect = slotIsBooked || !slotIsPast;

            slotButton.type = "button";
            slotButton.className = `slotButton ${slotIsBooked ? (isSelected ? "bookedSelected" : "booked") : (isSelected ? "selected" : (slotIsAvailable ? "available" : "unavailable"))}`;
            slotButton.disabled = !canSelect;
            slotButton.textContent = timeSlot;
            slotButton.title = slotIsBooked
                ? `${timeSlot} - Reserve pour ${bookedAppointment.patientEmail || "un patient"} (${durationMinutes} min)`
                : `${timeSlot} - ${slotIsAvailable ? "Disponible" : "Indisponible"} (${durationMinutes} min)`;

            if (canSelect) {
                slotButton.addEventListener("click", () => {
                    selectedSlotKey = slotKey;
                    setActionStatus("");
                    updateSelectedSlotCard();
                    renderPlanning();
                });
            }

            slotCell.appendChild(slotButton);
            planningGrid.appendChild(slotCell);
        });
    });
}

async function loadDoctorSpace() {
    const doctorStatusCard = document.getElementById("doctorStatusCard");
    const doctorContent = document.getElementById("doctorContent");

    try {
        const [profileResponse, availabilityResponse, appointmentsResponse] = await Promise.all([
            fetch(`${getDoctorApiBaseUrl()}/api/doctors/me`, {
                method: "GET",
                credentials: "include"
            }),
            fetch(`${getDoctorApiBaseUrl()}/api/doctors/availability`, {
                method: "GET",
                credentials: "include"
            }),
            fetch(`${getDoctorApiBaseUrl()}/api/appointments/doctor`, {
                method: "GET",
                credentials: "include"
            })
        ]);

        const profileText = await profileResponse.text();
        const availabilityText = await availabilityResponse.text();
        const appointmentsText = await appointmentsResponse.text();
        const profileData = parseDoctorSpaceResponse(profileText);
        const availabilityData = parseDoctorSpaceResponse(availabilityText);
        const appointmentsData = parseDoctorSpaceResponse(appointmentsText);

        if (!profileResponse.ok) {
            throw new Error(profileData.message || "Impossible de charger le profil medecin.");
        }

        if (!availabilityResponse.ok) {
            throw new Error(availabilityData.message || "Impossible de charger le planning medecin.");
        }

        if (!appointmentsResponse.ok) {
            throw new Error(appointmentsData.message || "Impossible de charger les rendez-vous du medecin.");
        }

        doctorProfile = profileData.doctor || {};
        weeklyAvailabilityMap = createAvailabilityMapFromResponse(availabilityData.weeklyAvailability);
        slotDurationMap = createDurationMapFromResponse(availabilityData.weeklyAvailability);
        bookedAppointmentsMap = new Map(
            (Array.isArray(appointmentsData.appointments) ? appointmentsData.appointments : []).map((appointment) => {
                return [getSlotKey(appointment.appointmentDate, appointment.appointmentTime), appointment];
            })
        );

        hydrateDoctorProfile();
        updateSelectedSlotCard();
        renderPlanning();

        document.getElementById("planningStatus").textContent = "Les creneaux rouges sont reserves. Pour les autres, vous pouvez regler disponibilite et duree.";
        doctorStatusCard.hidden = true;
        doctorContent.hidden = false;
    } catch (error) {
        console.error(error);
        doctorStatusCard.textContent = error.message || "Impossible de charger l'espace medecin.";
    }
}

async function saveSelectedSlotSettings() {
    if (!selectedSlotKey) {
        return;
    }

    const { dateKey, timeSlot } = parseSlotKey(selectedSlotKey);
    const dayOfWeek = getDayOfWeekFromDateKey(dateKey);
    const isAvailable = document.getElementById("selectedAvailability").value === "available";
    const durationMinutes = normalizeDurationMinutes(
        document.getElementById("selectedDuration").value
    );
    const toggleButton = document.getElementById("toggleAvailabilityButton");

    if (dayOfWeek === null || isSlotBooked(dateKey, timeSlot)) {
        updateSelectedSlotCard();
        return;
    }

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
                durationMinutes,
                isAvailable,
                timeSlot
            })
        });

        const responseText = await response.text();
        const data = parseDoctorSpaceResponse(responseText);

        if (!response.ok) {
            throw new Error(data.message || "Impossible de mettre a jour ce creneau.");
        }

        setSlotAvailability(dayOfWeek, timeSlot, isAvailable);
        setSlotDuration(dayOfWeek, timeSlot, durationMinutes);
        selectedSlotKey = "";
        updateSelectedSlotCard();
        renderPlanning();
        setActionStatus("Creneau mis a jour avec succes.", "success");
    } catch (error) {
        console.error(error);
        setActionStatus(error.message || "Impossible de mettre a jour ce creneau.", "error");
        updateSelectedSlotCard();
    }
}

async function saveBookedAppointmentDuration() {
    if (!selectedSlotKey) {
        return;
    }

    const { dateKey, timeSlot } = parseSlotKey(selectedSlotKey);
    const bookedAppointment = getBookedAppointment(dateKey, timeSlot);
    const durationMinutes = normalizeDurationMinutes(
        document.getElementById("bookedDuration").value
    );
    const saveButton = document.getElementById("saveBookedDurationButton");

    if (!bookedAppointment) {
        return;
    }

    saveButton.disabled = true;
    setBookedAppointmentStatus("Mise a jour de la duree en cours...");

    try {
        const response = await fetch(
            `${getDoctorApiBaseUrl()}/api/appointments/doctor/${bookedAppointment.id}/duration`,
            {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    durationMinutes
                })
            }
        );

        const responseText = await response.text();
        const data = parseDoctorSpaceResponse(responseText);

        if (!response.ok) {
            throw new Error(data.message || "Impossible de modifier la duree de ce rendez-vous.");
        }

        bookedAppointmentsMap.set(
            getSlotKey(dateKey, timeSlot),
            {
                ...bookedAppointment,
                durationMinutes
            }
        );

        renderPlanning();
        updateSelectedSlotCard();
        setBookedAppointmentStatus("Duree du rendez-vous mise a jour avec succes.", "success");
    } catch (error) {
        console.error(error);
        setBookedAppointmentStatus(
            error.message || "Impossible de modifier la duree de ce rendez-vous.",
            "error"
        );
    } finally {
        saveButton.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    hydrateDurationOptions();
    document.getElementById("toggleAvailabilityButton").addEventListener("click", saveSelectedSlotSettings);
    document.getElementById("saveBookedDurationButton").addEventListener("click", saveBookedAppointmentDuration);
    loadDoctorSpace();
});
