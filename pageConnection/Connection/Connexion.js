const loginForm = document.getElementById("loginForm");
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

function getDocteurUrl() {
    if (window.location.protocol === "file:") {
        return "http://localhost:3000/pageDocteur/Docteur.html";
    }

    return "/pageDocteur/Docteur.html";
}

loginForm.addEventListener("submit", async function(event){
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch(`${apiBaseUrl}/api/users/login`, {
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
        const data = parseApiResponse(responseText);

        if (!response.ok) {
            alert(data.message || "Connexion impossible.");
            return;
        }

        alert("Connexion réussie !");
        window.location.href = getDocteurUrl();
    } catch (error) {
        console.error(error);
        alert("Impossible de joindre le serveur. Vérifiez que le backend tourne sur le port 3000.");
    }
});
