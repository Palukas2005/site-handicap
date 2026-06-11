function getApiBaseUrl() {
    return window.location.protocol === "file:" ? "http://localhost:3000" : "";
}

function parseApiResponse(responseText) {
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

function getPatientNavigationMarkup() {
    return `
        <button class="colorGreen"><h2>HR</h2></button>
        <a href="../pageAccueil/index.html"><button class="Button"><h3>Accueil</h3></button></a>
        <a href="../pageDocteur/Docteur.html"><button class="Button"><h3>Docteur</h3></button></a>
        <a href="../pageRdv/Rdv.html"><button class="Button"><h3>Rendez-vous</h3></button></a>
        <a href="Contact.html"><button class="Button activeButton"><h3>Contact</h3></button></a>
    `;
}

function getDoctorNavigationMarkup() {
    return `
        <button class="colorGreen"><h2>HR</h2></button>
        <a href="../pageAccueil/index.html"><button class="Button"><h3>Accueil</h3></button></a>
        <a href="../pageMedecin/EspaceMedecin.html"><button class="Button"><h3>Mon planning</h3></button></a>
        <a href="../pageMedecin/RendezVousMedecin.html"><button class="Button"><h3>Rendez-vous patients</h3></button></a>
        <a href="Contact.html"><button class="Button activeButton"><h3>Contact</h3></button></a>
    `;
}

async function adaptNavigationToSession() {
    const roleNavigation = document.getElementById("roleNavigation");

    if (!roleNavigation) {
        return;
    }

    if (typeof getSessionUser !== "function") {
        roleNavigation.innerHTML = getPatientNavigationMarkup();
        return;
    }

    const sessionUser = await getSessionUser();

    roleNavigation.innerHTML = sessionUser?.role === "doctor"
        ? getDoctorNavigationMarkup()
        : getPatientNavigationMarkup();
}

document.addEventListener("DOMContentLoaded", () => {
    const contactForm = document.getElementById("contactForm");
    const contactSubmitButton = document.getElementById("contactSubmitButton");
    const contactStatus = document.getElementById("contactStatus");

    adaptNavigationToSession();

    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("contactName").value.trim();
        const email = document.getElementById("contactEmail").value.trim();
        const subject = document.getElementById("contactSubject").value.trim();
        const message = document.getElementById("contactMessage").value.trim();

        if (!name || !email || !subject || !message) {
            contactStatus.textContent = "Merci de remplir tous les champs avant l'envoi.";
            contactStatus.className = "contactStatus error";
            return;
        }

        contactSubmitButton.disabled = true;
        contactStatus.textContent = "Envoi du message en cours...";
        contactStatus.className = "contactStatus";

        try {
            const response = await fetch(`${getApiBaseUrl()}/api/contact`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    subject,
                    message
                })
            });

            const responseText = await response.text();
            const data = parseApiResponse(responseText);

            if (!response.ok) {
                throw new Error(data.message || "Impossible d'envoyer votre message.");
            }

            contactForm.reset();
            contactStatus.textContent = data.message || "Votre message a bien ete envoye.";
            contactStatus.className = "contactStatus success";
        } catch (error) {
            console.error(error);
            contactStatus.textContent = error.message || "Impossible d'envoyer votre message.";
            contactStatus.className = "contactStatus error";
        } finally {
            contactSubmitButton.disabled = false;
        }
    });
});
