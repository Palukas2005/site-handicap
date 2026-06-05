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

document.addEventListener("DOMContentLoaded", () => {
    const contactForm = document.getElementById("contactForm");
    const contactSubmitButton = document.getElementById("contactSubmitButton");
    const contactStatus = document.getElementById("contactStatus");

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
