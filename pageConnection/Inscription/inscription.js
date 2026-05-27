const registerForm = document.getElementById("registerForm");

registerForm.addEventListener("submit", function(event){

    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const savedUser = JSON.parse(localStorage.getItem("user"));

    if(savedUser !== null && email === savedUser.email){

        alert("Ce compte existe déjà.");
        return;

    }

    const user = {
        email: email,
        password: password
    };

    localStorage.setItem("user", JSON.stringify(user));

    alert("Compte créé avec succès !");

    window.location.href = "/Docteur.html";

});