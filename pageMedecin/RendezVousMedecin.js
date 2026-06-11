function getDoctorAppointmentsApiBaseUrl() {
    return window.location.protocol === "file:" ? "http://localhost:3000" : "";
}

const doctorConfig = window.HANDIREPERE_DOCTOR_CONFIG || {
    appointmentDurationOptions: [30, 45, 60]
};

let currentDoctorAppointments = [];

function parseDoctorAppointmentsResponse(responseText) {
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

function formatAppointmentDate(dateString) {
    const appointmentDate = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(appointmentDate.getTime())) {
        return dateString;
    }

    return new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(appointmentDate);
}

function formatCreationDate(dateString) {
    const createdAtDate = new Date(dateString);

    if (Number.isNaN(createdAtDate.getTime())) {
        return "Date d'enregistrement indisponible";
    }

    return new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(createdAtDate);
}

function formatDuration(durationMinutes) {
    const normalizedDuration = Number(durationMinutes);
    return Number.isInteger(normalizedDuration) && normalizedDuration > 0
        ? `${normalizedDuration} minutes`
        : "Information non renseignee";
}

function isPastAppointment(dateString, timeString) {
    const appointmentDateTime = new Date(`${dateString}T${timeString}:00`);

    if (Number.isNaN(appointmentDateTime.getTime())) {
        return false;
    }

    return appointmentDateTime.getTime() < Date.now();
}

function createInfoBlock(label, value) {
    const info = document.createElement("p");
    info.className = "appointmentInfo";

    const infoLabel = document.createElement("span");
    infoLabel.className = "appointmentInfoLabel";
    infoLabel.textContent = label;

    const infoValue = document.createElement("span");
    infoValue.className = "appointmentInfoValue";
    infoValue.textContent = value;

    info.append(infoLabel, infoValue);
    return info;
}

function normalizeAppointmentId(value) {
    const appointmentId = Number(value);
    return Number.isInteger(appointmentId) ? appointmentId : 0;
}

function normalizeDurationMinutes(value) {
    const durationMinutes = Number(value);

    if (doctorConfig.appointmentDurationOptions.includes(durationMinutes)) {
        return durationMinutes;
    }

    return doctorConfig.appointmentDurationOptions[0] || 30;
}

function setAppointmentDurationStatus(statusElement, message = "", type = "") {
    statusElement.textContent = message;
    statusElement.className = type
        ? `appointmentDurationStatus ${type}`
        : "appointmentDurationStatus";
}

async function saveAppointmentDuration(appointmentId, durationSelect, saveButton, statusElement, durationValueElement) {
    const durationMinutes = normalizeDurationMinutes(durationSelect.value);
    saveButton.disabled = true;
    setAppointmentDurationStatus(statusElement, "Mise a jour en cours...");

    try {
        const response = await fetch(
            `${getDoctorAppointmentsApiBaseUrl()}/api/appointments/doctor/${appointmentId}/duration`,
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
        const data = parseDoctorAppointmentsResponse(responseText);

        if (!response.ok) {
            throw new Error(data.message || "Impossible de modifier la duree de ce rendez-vous.");
        }

        currentDoctorAppointments = currentDoctorAppointments.map((appointment) => {
            if (normalizeAppointmentId(appointment.id) !== appointmentId) {
                return appointment;
            }

            return {
                ...appointment,
                durationMinutes
            };
        });

        if (durationValueElement) {
            durationValueElement.textContent = formatDuration(durationMinutes);
        }

        setAppointmentDurationStatus(statusElement, "Duree mise a jour avec succes.", "success");
    } catch (error) {
        console.error(error);
        setAppointmentDurationStatus(
            statusElement,
            error.message || "Impossible de modifier la duree de ce rendez-vous.",
            "error"
        );
    } finally {
        saveButton.disabled = false;
    }
}

function renderDoctorAppointments(appointments) {
    const appointmentsList = document.getElementById("doctorAppointmentsList");

    appointmentsList.innerHTML = "";

    appointments.forEach((appointment) => {
        const appointmentCard = document.createElement("article");
        appointmentCard.className = "doctorAppointmentCard";
        const appointmentId = normalizeAppointmentId(appointment.id);

        const appointmentHeader = document.createElement("div");
        appointmentHeader.className = "doctorAppointmentHeader";

        const title = document.createElement("h2");
        title.textContent = formatAppointmentDate(appointment.appointmentDate);

        const badge = document.createElement("span");
        const appointmentIsPast = isPastAppointment(
            appointment.appointmentDate,
            appointment.appointmentTime
        );
        badge.className = `appointmentBadge${appointmentIsPast ? " past" : ""}`;
        badge.textContent = appointmentIsPast ? "Passe" : "A venir";

        appointmentHeader.append(title, badge);

        const appointmentGrid = document.createElement("div");
        appointmentGrid.className = "doctorAppointmentGrid";
        const durationInfoBlock = createInfoBlock("Duree", formatDuration(appointment.durationMinutes));
        const durationValueElement = durationInfoBlock.querySelector(".appointmentInfoValue");
        appointmentGrid.append(
            createInfoBlock("Patient", appointment.patientEmail),
            createInfoBlock("Horaire", appointment.appointmentTime),
            durationInfoBlock,
            createInfoBlock("Reservation enregistree", formatCreationDate(appointment.createdAt))
        );

        const durationForm = document.createElement("div");
        durationForm.className = "appointmentDurationForm";

        const durationLabel = document.createElement("label");
        durationLabel.className = "appointmentDurationLabel";
        durationLabel.textContent = "Modifier la duree";

        const durationSelect = document.createElement("select");
        durationSelect.className = "appointmentDurationSelect";
        durationSelect.innerHTML = doctorConfig.appointmentDurationOptions.map((durationMinutes) => {
            return `
                <option value="${durationMinutes}">${durationMinutes} minutes</option>
            `;
        }).join("");
        durationSelect.value = String(normalizeDurationMinutes(appointment.durationMinutes));

        durationLabel.appendChild(durationSelect);

        const durationActions = document.createElement("div");
        durationActions.className = "appointmentDurationActions";

        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.className = "appointmentDurationButton";
        saveButton.textContent = "Enregistrer la duree";

        const statusElement = document.createElement("p");
        statusElement.className = "appointmentDurationStatus";

        saveButton.addEventListener("click", async () => {
            await saveAppointmentDuration(
                appointmentId,
                durationSelect,
                saveButton,
                statusElement,
                durationValueElement
            );
        });

        durationActions.append(saveButton, statusElement);
        durationForm.append(durationLabel, durationActions);

        appointmentCard.append(appointmentHeader, appointmentGrid, durationForm);
        appointmentsList.appendChild(appointmentCard);
    });
}

async function loadDoctorAppointments() {
    const statusCard = document.getElementById("doctorAppointmentsStatus");
    const emptyState = document.getElementById("doctorAppointmentsEmptyState");
    const appointmentsList = document.getElementById("doctorAppointmentsList");

    try {
        const response = await fetch(`${getDoctorAppointmentsApiBaseUrl()}/api/appointments/doctor`, {
            method: "GET",
            credentials: "include"
        });

        const responseText = await response.text();
        const data = parseDoctorAppointmentsResponse(responseText);

        if (!response.ok) {
            throw new Error(data.message || "Impossible de charger les rendez-vous patients.");
        }

        const appointments = Array.isArray(data.appointments) ? data.appointments : [];
        currentDoctorAppointments = appointments.map((appointment) => {
            return {
                ...appointment,
                id: normalizeAppointmentId(appointment.id),
                durationMinutes: normalizeDurationMinutes(appointment.durationMinutes)
            };
        });

        statusCard.hidden = true;

        if (currentDoctorAppointments.length === 0) {
            emptyState.hidden = false;
            appointmentsList.hidden = true;
            return;
        }

        renderDoctorAppointments(currentDoctorAppointments);
        emptyState.hidden = true;
        appointmentsList.hidden = false;
    } catch (error) {
        console.error(error);
        statusCard.textContent = error.message || "Impossible de charger les rendez-vous patients.";
        emptyState.hidden = true;
        appointmentsList.hidden = true;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadDoctorAppointments();
});
