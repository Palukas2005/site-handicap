const currentUser = JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {
    window.location.href = "../pageConnection/Connection/pageConnection.html";
}

async function chargerMedecins(){
    const resultats = document.getElementById("resultats");

    if (resultats.innerHTML.trim() !== "") {
        resultats.innerHTML = "";
        return;
    }

    resultats.innerHTML = "Chargement...";

    try{

        const reponse = await fetch(
            "https://randomuser.me/api/?results=5"
        );

        const donnees = await reponse.json();

        resultats.innerHTML = "";

        donnees.results.forEach(personne => {

            resultats.innerHTML += `

                <div class="medecin">
                    <img src="${personne.picture.large}" alt="Photo du médecin">
                    <h2>
                        Dr ${personne.name.first} ${personne.name.last}
                    </h2>
                    <p>
                        Ville : ${personne.location.city}
                    </p>
                </div>
            `;
        });

    } catch(erreur){

        resultats.innerHTML = "Erreur lors du chargement.";

        console.error(erreur);
    }
}
