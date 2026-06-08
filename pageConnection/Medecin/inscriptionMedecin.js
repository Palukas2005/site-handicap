const doctorRegisterForm = document.getElementById("doctorRegisterForm");
const doctorRegisterApiBaseUrl = window.location.protocol === "file:" ? "http://localhost:3000" : "";
const doctorConfig = window.HANDIREPERE_DOCTOR_CONFIG || {
    doctorAccountEmail: "louis.ortega@coda-student.school",
    doctorDisplayName: "Louis"
};

function parseDoctorRegisterApiResponse(responseText) {
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

function getDoctorLoginUrl() {
    if (window.location.protocol === "file:") {
        return "http://localhost:3000/pageConnection/Medecin/pageConnectionMedecin.html";
    }

    return "/pageConnection/Medecin/pageConnectionMedecin.html";
}

document.getElementById("doctorRegisterEmail").value = doctorConfig.doctorAccountEmail;
document.getElementById("doctorFullName").value = doctorConfig.doctorDisplayName;

doctorRegisterForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = document.getElementById("doctorFullName").value;
    const specialty = document.getElementById("doctorSpecialty").value;
    const cabinetName = document.getElementById("doctorCabinetName").value;
    const email = document.getElementById("doctorRegisterEmail").value;
    const password = document.getElementById("doctorRegisterPassword").value;

    try {
        const response = await fetch(`${doctorRegisterApiBaseUrl}/api/doctors/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fullName,
                specialty,
                cabinetName,
                email,
                password
            })
        });

        const responseText = await response.text();
        const data = parseDoctorRegisterApiResponse(responseText);

        if (!response.ok) {
            alert(data.message || "Inscription medecin impossible.");
            return;
        }

        alert("Compte medecin cree avec succes !");
        window.location.href = getDoctorLoginUrl();
    } catch (error) {
        console.error(error);
        alert("Impossible de joindre le serveur. Verifiez que le backend tourne sur le port 3000.");
    }
});
