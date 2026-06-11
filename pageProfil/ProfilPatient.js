function getPatientProfileApiBaseUrl() {
    return window.location.protocol === "file:" ? "http://localhost:3000" : "";
}

function parsePatientProfileResponse(responseText) {
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

function getDisplayValue(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
}

function getPatientDisplayName(user) {
    const fullName = [
        getDisplayValue(user.firstName).trim(),
        getDisplayValue(user.lastName).trim()
    ].filter(Boolean).join(" ");

    return fullName || "Mon profil";
}

function setPatientProfileFormStatus(message = "", type = "") {
    const status = document.getElementById("patientProfileFormStatus");
    status.textContent = message;
    status.className = type ? `formStatus ${type}` : "formStatus";
}

function hydrateAccountProfile(user) {
    const email = user.email || "Information non renseignee";
    const displayName = getPatientDisplayName(user);

    document.title = "Mon profil patient";
    document.getElementById("patientProfileTitle").textContent = displayName;
    document.getElementById("patientProfileLead").textContent = "Retrouvez ici les informations de votre compte patient et modifiez vos parametres generaux.";
    document.getElementById("patientEmailMeta").textContent = email;
    document.getElementById("patientFirstName").value = getDisplayValue(user.firstName);
    document.getElementById("patientLastName").value = getDisplayValue(user.lastName);
    document.getElementById("patientEmail").value = email;
    document.getElementById("patientEmailNotifications").checked = user.emailNotificationsEnabled !== false;
    document.getElementById("patientAppointmentReminders").checked = user.appointmentRemindersEnabled !== false;
}

async function loadPatientProfile() {
    const statusCard = document.getElementById("patientProfileStatusCard");
    const content = document.getElementById("patientProfileContent");

    try {
        const userResponse = await fetch(`${getPatientProfileApiBaseUrl()}/api/users/me`, {
            method: "GET",
            credentials: "include",
            cache: "no-store"
        });
        const userResponseText = await userResponse.text();
        const userData = parsePatientProfileResponse(userResponseText);

        if (!userResponse.ok) {
            throw new Error(userData.message || "Impossible de charger votre profil.");
        }

        hydrateAccountProfile(userData.user || {});
        statusCard.hidden = true;
        content.hidden = false;
    } catch (error) {
        console.error(error);
        statusCard.textContent = error.message || "Impossible de charger votre profil.";
    }
}

async function savePatientProfile(event) {
    event.preventDefault();

    const saveButton = document.getElementById("patientProfileSaveButton");
    const firstName = document.getElementById("patientFirstName").value.trim();
    const lastName = document.getElementById("patientLastName").value.trim();
    const emailNotificationsEnabled = document.getElementById("patientEmailNotifications").checked;
    const appointmentRemindersEnabled = document.getElementById("patientAppointmentReminders").checked;
    const originalButtonText = saveButton.textContent;

    saveButton.disabled = true;
    saveButton.textContent = "Enregistrement...";
    setPatientProfileFormStatus("Sauvegarde des modifications en cours...");

    try {
        const response = await fetch(`${getPatientProfileApiBaseUrl()}/api/users/me`, {
            method: "PUT",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                firstName,
                lastName,
                emailNotificationsEnabled,
                appointmentRemindersEnabled
            })
        });

        const responseText = await response.text();
        const data = parsePatientProfileResponse(responseText);

        if (!response.ok) {
            throw new Error(data.message || "Impossible de mettre a jour le profil.");
        }

        hydrateAccountProfile(data.user || {});
        setPatientProfileFormStatus(
            data.message || "Profil patient mis a jour avec succes.",
            "success"
        );
    } catch (error) {
        console.error(error);
        setPatientProfileFormStatus(
            error.message || "Impossible de mettre a jour le profil.",
            "error"
        );
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = originalButtonText;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("patientProfileForm").addEventListener("submit", savePatientProfile);
    loadPatientProfile();
});
