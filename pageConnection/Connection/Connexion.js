const loginForm = document.getElementById("loginForm");
const apiBaseUrl = window.location.protocol === "file:" ? "http://localhost:3000" : "";

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

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Connexion impossible.");
            return;
        }

        alert("Connexion réussie !");
        window.location.href = "../../pageDocteur/Docteur.html";
    } catch (error) {
        console.error(error);
        alert("Impossible de joindre le serveur. Vérifiez que le backend tourne sur le port 3000.");
    }
});
