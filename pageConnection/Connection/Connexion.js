const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", function(event){
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const savedUser = JSON.parse(localStorage.getItem("user"));

    if(savedUser === null){
        alert("Aucun compte trouvé. Veuillez vous inscrire.");
        return;
    }

    if(email === savedUser.email && password === savedUser.password){
        alert("Connexion réussie !");
        window.location.href = "/pageDocteur/Docteur.html";
    }else{
        alert("Email ou mot de passe incorrect.");
    }
});