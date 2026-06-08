const doctorLoginForm = document.getElementById("doctorLoginForm");
const doctorApiBaseUrl = window.location.protocol === "file:" ? "http://localhost:3000" : "";
const doctorConfig = window.HANDIREPERE_DOCTOR_CONFIG || {
    doctorAccountEmail: "louis.ortega@coda-student.school"
};

function parseDoctorApiResponse(responseText) {
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

function getDoctorSpaceUrl() {
    if (window.location.protocol === "file:") {
        return "http://localhost:3000/pageMedecin/EspaceMedecin.html";
    }

    return "/pageMedecin/EspaceMedecin.html";
}

document.getElementById("doctorEmail").value = doctorConfig.doctorAccountEmail;

doctorLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("doctorEmail").value;
    const password = document.getElementById("doctorPassword").value;

    try {
        const response = await fetch(`${doctorApiBaseUrl}/api/doctors/login`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const responseText = await response.text();
        const data = parseDoctorApiResponse(responseText);

        if (!response.ok) {
            alert(data.message || "Connexion medecin impossible.");
            return;
        }

        alert("Connexion medecin reussie !");
        window.location.href = getDoctorSpaceUrl();
    } catch (error) {
        console.error(error);
        alert("Impossible de joindre le serveur. Verifiez que le backend tourne sur le port 3000.");
    }
});
