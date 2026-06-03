const registerForm = document.getElementById("registerForm");
const apiBaseUrl = window.location.protocol === "file:" ? "http://localhost:3000" : "";

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

function getConnectionUrl() {
    if (window.location.protocol === "file:") {
        return "http://localhost:3000/pageConnection/Connection/pageConnection.html";
    }

    return "/pageConnection/Connection/pageConnection.html";
}

registerForm.addEventListener("submit", async function(event){

    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch(`${apiBaseUrl}/api/users/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const responseText = await response.text();
        const data = parseApiResponse(responseText);

        if (!response.ok) {
            alert(data.message || "Inscription impossible.");
            return;
        }

        alert("Compte créé avec succès !");
        window.location.href = getConnectionUrl();
    } catch (error) {
        console.error(error);
        alert("Impossible de joindre le serveur. Vérifiez que le backend tourne sur le port 3000.");
    }

});
