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
let availabilityToggleSyncing = false;
let availabilityModeIsAvailable = false;
let availabilityModeArmed = false;
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return date.getTime() < today.getTime();
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

function updateAvailabilityToggle(isAvailable, disabled = false) {
    const availabilityToggle = document.getElementById("selectedAvailabilityToggle");
    const availabilityLabel = document.getElementById("selectedAvailabilityLabel");
    availabilityModeIsAvailable = isAvailable === true;

    availabilityToggleSyncing = true;
    availabilityToggle.checked = availabilityModeIsAvailable;
    availabilityToggle.disabled = disabled;
    availabilityLabel.textContent = availabilityModeIsAvailable ? "Disponible" : "Indisponible";
    availabilityToggleSyncing = false;
}

function setAvailabilityModeStatus(message) {
    document.getElementById("availabilityModeStatus").textContent = message;
}

function refreshAvailabilityPanelMessage() {
    if (availabilityModeArmed) {
        setAvailabilityModeStatus(
            `Le prochain creneau libre passera en ${availabilityModeIsAvailable ? "disponible" : "indisponible"}.`
        );
        return;
    }

    setAvailabilityModeStatus(
        "Choisissez un etat puis cliquez sur un creneau libre."
    );
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
    document.getElementById("selectedSlotCard").hidden = false;
    document.getElementById("availableSlotPanel").hidden = false;
    document.getElementById("bookedAppointmentCard").hidden = true;
    document.getElementById("bookedAppointmentPanel").hidden = true;
    document.getElementById("selectionCardTitle").textContent = "Creneau selectionne";
    document.getElementById("selectionCardText").textContent = "Utilisez le switch pour rendre un creneau disponible ou indisponible instantanement, puis enregistrez la duree seulement si vous la modifiez.";
}

function showBookedAppointmentPanel() {
    document.getElementById("selectedSlotCard").hidden = true;
    document.getElementById("availableSlotPanel").hidden = true;
    document.getElementById("bookedAppointmentCard").hidden = false;
    document.getElementById("bookedAppointmentPanel").hidden = false;
}

function updateSelectedSlotCard() {
    const bookedDurationSelect = document.getElementById("bookedDuration");
    const durationSelect = document.getElementById("selectedDuration");
    const saveBookedDurationButton = document.getElementById("saveBookedDurationButton");
    const saveDurationButton = document.getElementById("saveDurationButton");

    if (!selectedSlotKey) {
        showAvailableSlotPanel();
        document.getElementById("selectedDay").textContent = "Aucune selection";
        document.getElementById("selectedTime").textContent = "Aucun horaire selectionne";
        updateAvailabilityToggle(availabilityModeIsAvailable, false);
        durationSelect.disabled = true;
        durationSelect.value = String(doctorConfig.defaultAppointmentDurationMinutes);
        bookedDurationSelect.disabled = true;
        bookedDurationSelect.value = String(doctorConfig.defaultAppointmentDurationMinutes);
        saveBookedDurationButton.disabled = true;
        saveDurationButton.disabled = true;
        saveDurationButton.textContent = "Selectionnez un creneau";
        refreshAvailabilityPanelMessage();
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
        refreshAvailabilityPanelMessage();
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
    if (!availabilityModeArmed) {
        updateAvailabilityToggle(slotIsAvailable, false);
    }
    durationSelect.disabled = slotIsBooked;
    durationSelect.value = String(durationMinutes);

    saveDurationButton.disabled = false;
    saveDurationButton.textContent = "Enregistrer la duree";
    refreshAvailabilityPanelMessage();
    setActionStatus("");
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
                slotButton.addEventListener("click", async () => {
                    selectedSlotKey = slotKey;
                    setActionStatus("");
                    updateSelectedSlotCard();
                    renderPlanning();

                    if (slotIsBooked || !availabilityModeArmed) {
                        return;
                    }

                    if (slotIsAvailable === availabilityModeIsAvailable) {
                        availabilityModeArmed = false;
                        refreshAvailabilityPanelMessage();
                        setActionStatus("Le creneau correspond deja a l'etat choisi.", "success");
                        return;
                    }

                    await saveSelectedSlotAvailability({
                        isAvailableOverride: availabilityModeIsAvailable,
                        consumeArmedMode: true
                    });
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

        document.getElementById("planningStatus").textContent = "Les creneaux rouges sont reserves. Pour les autres, le switch met a jour la disponibilite immediatement et le bouton sert uniquement a enregistrer la duree.";
        doctorStatusCard.hidden = true;
        doctorContent.hidden = false;
    } catch (error) {
        console.error(error);
        doctorStatusCard.textContent = error.message || "Impossible de charger l'espace medecin.";
    }
}

async function saveSelectedSlotAvailability(options = {}) {
    if (!selectedSlotKey) {
        return;
    }

    const { dateKey, timeSlot } = parseSlotKey(selectedSlotKey);
    const dayOfWeek = getDayOfWeekFromDateKey(dateKey);
    const availabilityToggle = document.getElementById("selectedAvailabilityToggle");
    const isAvailable = typeof options.isAvailableOverride === "boolean"
        ? options.isAvailableOverride
        : availabilityToggle.checked;

    if (dayOfWeek === null || isSlotBooked(dateKey, timeSlot)) {
        updateSelectedSlotCard();
        return;
    }

    availabilityToggle.disabled = true;
    setActionStatus("Mise a jour de la disponibilite en cours...");

    try {
        const response = await fetch(`${getDoctorApiBaseUrl()}/api/doctors/availability`, {
            method: "PUT",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                dayOfWeek,
                isAvailable,
                timeSlot
            })
        });

        const responseText = await response.text();
        const data = parseDoctorSpaceResponse(responseText);

        if (!response.ok) {
            throw new Error(data.message || "Impossible de mettre a jour ce creneau.");
        }

        availabilityModeArmed = false;
        setSlotAvailability(dayOfWeek, timeSlot, isAvailable);
        updateAvailabilityToggle(isAvailable, false);
        refreshAvailabilityPanelMessage();
        updateSelectedSlotCard();
        renderPlanning();
        setActionStatus("Disponibilite mise a jour avec succes.", "success");
    } catch (error) {
        console.error(error);
        if (options.consumeArmedMode) {
            availabilityModeArmed = false;
        }
        refreshAvailabilityPanelMessage();
        setActionStatus(error.message || "Impossible de mettre a jour ce creneau.", "error");
        updateSelectedSlotCard();
    }
}

async function saveSelectedSlotDuration() {
    if (!selectedSlotKey) {
        return;
    }

    const { dateKey, timeSlot } = parseSlotKey(selectedSlotKey);
    const dayOfWeek = getDayOfWeekFromDateKey(dateKey);
    const durationMinutes = normalizeDurationMinutes(
        document.getElementById("selectedDuration").value
    );
    const saveDurationButton = document.getElementById("saveDurationButton");

    if (dayOfWeek === null || isSlotBooked(dateKey, timeSlot)) {
        updateSelectedSlotCard();
        return;
    }

    saveDurationButton.disabled = true;
    setActionStatus("Mise a jour de la duree en cours...");

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
                isAvailable: isTemplateSlotAvailable(dateKey, timeSlot),
                timeSlot
            })
        });

        const responseText = await response.text();
        const data = parseDoctorSpaceResponse(responseText);

        if (!response.ok) {
            throw new Error(data.message || "Impossible de mettre a jour la duree de ce creneau.");
        }

        setSlotDuration(dayOfWeek, timeSlot, durationMinutes);
        updateSelectedSlotCard();
        renderPlanning();
        setActionStatus("Duree du creneau mise a jour avec succes.", "success");
    } catch (error) {
        console.error(error);
        setActionStatus(error.message || "Impossible de mettre a jour la duree de ce creneau.", "error");
        updateSelectedSlotCard();
    } finally {
        saveDurationButton.disabled = false;
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
    document.getElementById("selectedAvailabilityToggle").addEventListener("change", () => {
        if (availabilityToggleSyncing) {
            return;
        }

        const { checked } = document.getElementById("selectedAvailabilityToggle");
        updateAvailabilityToggle(checked, false);
        const selectedSlot = selectedSlotKey ? parseSlotKey(selectedSlotKey) : null;
        const selectedSlotIsBooked = selectedSlot
            ? isSlotBooked(selectedSlot.dateKey, selectedSlot.timeSlot)
            : false;

        if (!selectedSlotKey || selectedSlotIsBooked) {
            availabilityModeArmed = true;
            refreshAvailabilityPanelMessage();
            setActionStatus("");
            setBookedAppointmentStatus("");
            return;
        }

        availabilityModeArmed = false;
        refreshAvailabilityPanelMessage();
        saveSelectedSlotAvailability({
            isAvailableOverride: checked
        });
    });
    document.getElementById("saveDurationButton").addEventListener("click", saveSelectedSlotDuration);
    document.getElementById("saveBookedDurationButton").addEventListener("click", saveBookedAppointmentDuration);
    updateAvailabilityToggle(availabilityModeIsAvailable, false);
    refreshAvailabilityPanelMessage();
    loadDoctorSpace();
});
