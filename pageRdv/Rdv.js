function getApiBaseUrl() {
    return window.location.protocol === "file:" ? "http://localhost:3000" : "";
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
                    ${buildInfoRow("Cabinet", appointment.doctorCabinet || "Information non renseignee")}
                    ${buildInfoRow("Localisation", doctorLocation || "Information non renseignee")}
                    ${buildInfoRow(
                        "Email professionnel",
                        appointment.doctorEmail || "Information non renseignee",
                        appointment.doctorEmail ? `mailto:${appointment.doctorEmail}` : ""
                    )}
                </div>
            </article>
        `;
    }).join("");
}

async function loadAppointments() {
    const statusCard = document.getElementById("rdvStatusCard");
    const emptyState = document.getElementById("rdvEmptyState");
    const rdvList = document.getElementById("rdvList");

    statusCard.hidden = false;
    emptyState.hidden = true;
    rdvList.hidden = true;
    statusCard.textContent = "Chargement de vos rendez-vous...";

    try {
        const response = await fetch(`${getApiBaseUrl()}/api/appointments/mine`, {
            method: "GET",
            credentials: "include"
        });

        const responseText = await response.text();
        const data = responseText ? JSON.parse(responseText) : {};

        if (!response.ok) {
            throw new Error(data.message || "Impossible de charger vos rendez-vous.");
        }

        if (!data.appointments || data.appointments.length === 0) {
            statusCard.hidden = true;
            emptyState.hidden = false;
            return;
        }

        renderAppointments(data.appointments);
        statusCard.hidden = true;
        rdvList.hidden = false;
    } catch (error) {
        console.error(error);
        statusCard.textContent = "Impossible de charger vos rendez-vous. Redemarrez le backend si la nouvelle route n'est pas encore active.";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadAppointments();
});
