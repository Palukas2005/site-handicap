function getApiBaseUrl() {
    return window.location.protocol === "file:" ? "http://localhost:3000" : "";
}

let currentAppointments = [];

function normalizeAppointmentId(value) {
    const appointmentId = Number(value);
    return Number.isInteger(appointmentId) ? appointmentId : 0;
}

function formatAppointmentDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(new Date(year, month - 1, day));
}

function isUpcomingAppointment(dateString, timeString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const [hours, minutes] = timeString.split(":").map(Number);
    const appointmentDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return appointmentDate.getTime() >= Date.now();
}

function buildInfoRow(label, value, href = "") {
    const content = href
        ? `<a class="rdvInfoValue rdvInfoLink" href="${href}">${value}</a>`
        : `<span class="rdvInfoValue">${value}</span>`;

    return `
        <p class="rdvInfo">
            <span class="rdvInfoLabel">${label}</span>
            ${content}
        </p>
    `;
}

function formatDuration(durationMinutes) {
    const normalizedDuration = Number(durationMinutes);
    return Number.isInteger(normalizedDuration) && normalizedDuration > 0
        ? `${normalizedDuration} minutes`
        : "Information non renseignee";
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

function setStatusCardMessage(message, type = "") {
    const statusCard = document.getElementById("rdvStatusCard");
    statusCard.hidden = !message;
    statusCard.textContent = message;
    statusCard.className = type ? `rdvStatusCard ${type}` : "rdvStatusCard";
}

function setEmptyStateNotice(message = "", type = "") {
    const emptyNotice = document.getElementById("rdvEmptyNotice");
    emptyNotice.hidden = !message;
    emptyNotice.textContent = message;
    emptyNotice.className = type ? `rdvEmptyNotice ${type}` : "rdvEmptyNotice";
}

function updateAppointmentsView({
    emptyStateNotice = "",
    emptyStateNoticeType = "",
    statusMessage = "",
    statusType = ""
} = {}) {
    const emptyState = document.getElementById("rdvEmptyState");
    const rdvList = document.getElementById("rdvList");

    if (currentAppointments.length === 0) {
        setEmptyStateNotice(emptyStateNotice, emptyStateNoticeType);
        setStatusCardMessage("");
        emptyState.hidden = false;
        rdvList.hidden = true;
        return;
    }

    setEmptyStateNotice("");
    renderAppointments(currentAppointments);

    if (statusMessage) {
        setStatusCardMessage(statusMessage, statusType);
    } else {
        setStatusCardMessage("");
    }

    rdvList.hidden = false;
    emptyState.hidden = true;
}

function removeAppointmentFromView(appointmentId, button) {
    const emptyState = document.getElementById("rdvEmptyState");
    const rdvList = document.getElementById("rdvList");
    const appointmentCard = button.closest(".rdvCard");

    currentAppointments = currentAppointments.filter((appointment) => {
        return normalizeAppointmentId(appointment.id) !== appointmentId;
    });

    if (appointmentCard) {
        appointmentCard.remove();
    }

    if (currentAppointments.length === 0) {
        updateAppointmentsView({
            emptyStateNotice: "Le rendez-vous a bien ete supprime.",
            emptyStateNoticeType: "success"
        });
        return;
    }

    setEmptyStateNotice("");
    setStatusCardMessage("Rendez-vous supprime avec succes.", "success");
    rdvList.hidden = false;
    emptyState.hidden = true;
}

function renderAppointments(appointments) {
    const rdvList = document.getElementById("rdvList");

    rdvList.innerHTML = appointments.map((appointment) => {
        const appointmentStatus = isUpcomingAppointment(
            appointment.appointmentDate,
            appointment.appointmentTime
        )
            ? "A venir"
            : "Passe";

        const doctorLocation = [appointment.doctorCity, appointment.doctorRegion]
            .filter(Boolean)
            .join(" - ");

        return `
            <article class="rdvCard">
                <h2>${appointment.doctorName}</h2>
                <span class="rdvTag">${appointmentStatus}</span>

                <div class="rdvDetails">
                    ${buildInfoRow("Date", formatAppointmentDate(appointment.appointmentDate))}
                    ${buildInfoRow("Heure", appointment.appointmentTime)}
                    ${buildInfoRow("Duree", formatDuration(appointment.durationMinutes))}
                    ${buildInfoRow("Cabinet", appointment.doctorCabinet || "Information non renseignee")}
                    ${buildInfoRow("Localisation", doctorLocation || "Information non renseignee")}
                    ${buildInfoRow(
                        "Email professionnel",
                        appointment.doctorEmail || "Information non renseignee",
                        appointment.doctorEmail ? `mailto:${appointment.doctorEmail}` : ""
                    )}
                </div>

                <div class="rdvActions">
                    <button class="deleteAppointmentButton" type="button" data-delete-appointment="${appointment.id}">
                        Supprimer ce rendez-vous
                    </button>
                </div>
            </article>
        `;
    }).join("");

    rdvList.querySelectorAll("[data-delete-appointment]").forEach((button) => {
        button.addEventListener("click", async () => {
            const appointmentId = normalizeAppointmentId(button.dataset.deleteAppointment);

            if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
                return;
            }

            if (!window.confirm("Voulez-vous vraiment supprimer ce rendez-vous ?")) {
                return;
            }

            await deleteAppointment(appointmentId, button);
        });
    });
}

async function deleteAppointment(appointmentId, button) {
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Suppression...";

    try {
        const response = await fetch(`${getApiBaseUrl()}/api/appointments/${appointmentId}`, {
            method: "DELETE",
            credentials: "include"
        });

        const responseText = await response.text();
        const data = parseApiResponse(
            responseText,
            "Impossible de supprimer ce rendez-vous. Redemarrez le backend pour activer l'API des rendez-vous."
        );

        if (!response.ok) {
            throw new Error(data.message || "Impossible de supprimer ce rendez-vous.");
        }

        removeAppointmentFromView(appointmentId, button);
    } catch (error) {
        console.error(error);
        setStatusCardMessage(
            error.message || "Impossible de supprimer ce rendez-vous.",
            "error"
        );
        button.disabled = false;
        button.textContent = originalText;
    }
}

async function loadAppointments({
    emptyStateNotice = "",
    emptyStateNoticeType = "",
    showLoadingState = true,
    statusMessage = "",
    statusType = ""
} = {}) {
    const statusCard = document.getElementById("rdvStatusCard");
    const emptyState = document.getElementById("rdvEmptyState");
    const rdvList = document.getElementById("rdvList");

    if (showLoadingState) {
        setStatusCardMessage("Chargement de vos rendez-vous...", "loading");
        emptyState.hidden = true;
        rdvList.hidden = true;
    }

    try {
        const response = await fetch(`${getApiBaseUrl()}/api/appointments/mine`, {
            method: "GET",
            credentials: "include",
            cache: "no-store"
        });

        const responseText = await response.text();
        const data = parseApiResponse(
            responseText,
            "Impossible de charger vos rendez-vous. Redemarrez le backend pour activer l'API des rendez-vous."
        );

        if (!response.ok) {
            throw new Error(data.message || "Impossible de charger vos rendez-vous.");
        }

        currentAppointments = Array.isArray(data.appointments)
            ? data.appointments.map((appointment) => {
                return {
                    ...appointment,
                    id: normalizeAppointmentId(appointment.id)
                };
            })
            : [];
        updateAppointmentsView({
            emptyStateNotice,
            emptyStateNoticeType,
            statusMessage,
            statusType
        });
    } catch (error) {
        console.error(error);
        setEmptyStateNotice("");
        setStatusCardMessage(
            error.message || "Impossible de charger vos rendez-vous. Redemarrez le backend pour activer l'API des rendez-vous.",
            "error"
        );
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadAppointments();
});
