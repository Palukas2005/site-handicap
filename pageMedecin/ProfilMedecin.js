function getDoctorProfileApiBaseUrl() {
    return window.location.protocol === "file:" ? "http://localhost:3000" : "";
}

function parseDoctorProfileResponse(responseText) {
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

function getDoctorDisplayName(doctor) {
    const fullName = [
        getDisplayValue(doctor.firstName).trim(),
        getDisplayValue(doctor.lastName).trim()
    ].filter(Boolean).join(" ");

    return fullName || getDisplayValue(doctor.fullName, "Mon profil professionnel");
}

function setDoctorProfileFormStatus(message = "", type = "") {
    const status = document.getElementById("doctorProfileFormStatus");
    status.textContent = message;
    status.className = type ? `formStatus ${type}` : "formStatus";
}

function hydrateDoctorProfile(doctor) {
    const email = doctor.email || "Information non renseignee";
    const displayName = getDoctorDisplayName(doctor);
    const cabinetName = getDisplayValue(doctor.cabinetName);

    document.title = `${displayName} - Profil medecin`;
    document.getElementById("doctorProfileTitle").textContent = displayName;
    document.getElementById("doctorProfileLead").textContent = "Retrouvez ici les informations de votre compte medecin et modifiez vos parametres generaux.";
    document.getElementById("doctorEmailMeta").textContent = email;
    document.getElementById("doctorCabinetMeta").textContent = cabinetName || "Cabinet non renseigne";
    document.getElementById("doctorFirstName").value = getDisplayValue(doctor.firstName);
    document.getElementById("doctorLastName").value = getDisplayValue(doctor.lastName);
    document.getElementById("doctorEmail").value = email;
    document.getElementById("doctorSpecialty").value = getDisplayValue(doctor.specialty);
    document.getElementById("doctorCabinet").value = cabinetName;
    document.getElementById("doctorEmailNotifications").checked = doctor.emailNotificationsEnabled !== false;
    document.getElementById("doctorAppointmentReminders").checked = doctor.appointmentRemindersEnabled !== false;
}

async function loadDoctorProfilePage() {
    const statusCard = document.getElementById("doctorProfileStatusCard");
    const content = document.getElementById("doctorProfileContent");

    try {
        const doctorResponse = await fetch(`${getDoctorProfileApiBaseUrl()}/api/doctors/me`, {
            method: "GET",
            credentials: "include",
            cache: "no-store"
        });
        const doctorResponseText = await doctorResponse.text();
        const doctorData = parseDoctorProfileResponse(doctorResponseText);

        if (!doctorResponse.ok) {
            throw new Error(doctorData.message || "Impossible de charger votre profil medecin.");
        }

        hydrateDoctorProfile(doctorData.doctor || {});
        statusCard.hidden = true;
        content.hidden = false;
    } catch (error) {
        console.error(error);
        statusCard.textContent = error.message || "Impossible de charger votre profil medecin.";
    }
}

async function saveDoctorProfile(event) {
    event.preventDefault();

    const saveButton = document.getElementById("doctorProfileSaveButton");
    const firstName = document.getElementById("doctorFirstName").value.trim();
    const lastName = document.getElementById("doctorLastName").value.trim();
    const specialty = document.getElementById("doctorSpecialty").value.trim();
    const cabinetName = document.getElementById("doctorCabinet").value.trim();
    const emailNotificationsEnabled = document.getElementById("doctorEmailNotifications").checked;
    const appointmentRemindersEnabled = document.getElementById("doctorAppointmentReminders").checked;
    const originalButtonText = saveButton.textContent;

    saveButton.disabled = true;
    saveButton.textContent = "Enregistrement...";
    setDoctorProfileFormStatus("Sauvegarde des modifications en cours...");

    try {
        const response = await fetch(`${getDoctorProfileApiBaseUrl()}/api/doctors/me`, {
            method: "PUT",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                firstName,
                lastName,
                specialty,
                cabinetName,
                emailNotificationsEnabled,
                appointmentRemindersEnabled
            })
        });

        const responseText = await response.text();
        const data = parseDoctorProfileResponse(responseText);

        if (!response.ok) {
            throw new Error(data.message || "Impossible de mettre a jour le profil medecin.");
        }

        hydrateDoctorProfile(data.doctor || {});
        setDoctorProfileFormStatus(
            data.message || "Profil medecin mis a jour avec succes.",
            "success"
        );
    } catch (error) {
        console.error(error);
        setDoctorProfileFormStatus(
            error.message || "Impossible de mettre a jour le profil medecin.",
            "error"
        );
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = originalButtonText;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("doctorProfileForm").addEventListener("submit", saveDoctorProfile);
    loadDoctorProfilePage();
});
