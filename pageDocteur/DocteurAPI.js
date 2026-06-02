document.addEventListener("DOMContentLoaded", () => {
    chargerMedecins();
});

async function chargerMedecins(){
    const resultats = document.getElementById("resultats");

    resultats.innerHTML = `
        <p class="statusMessage">
            Chargement des profils en cours...
        </p>
    `;

    try{

        const reponse = await fetch(
            "https://randomuser.me/api/?results=5"
        );

        const donnees = await reponse.json();

        resultats.innerHTML = "";

        resultats.innerHTML = donnees.results.map((personne) => {
            return `
                <article class="medecin">
                    <div class="medecinHeader">
                        <img class="medecinPhoto" src="${personne.picture.large}" alt="Photo du médecin">
                        <div class="medecinIdentity">
                            <p class="medecinLabel">Profil disponible</p>
                            <h2 class="medecinNom">
                                Dr ${personne.name.first} ${personne.name.last}
                            </h2>
                            <p class="medecinLieu">
                                ${personne.location.city}, ${personne.location.country}
                            </p>
                        </div>
                    </div>
                    <div class="medecinDetails">
                        <p>
                            <span>Téléphone</span>
                            <a href="tel:${personne.phone}">${personne.phone}</a>
                        </p>
                        <p>
                            <span>Email</span>
                            <a href="mailto:${personne.email}">${personne.email}</a>
                        </p>
                    </div>
                </article>
            `;
        }).join("");

    } catch(erreur){

        resultats.innerHTML = `
            <p class="statusMessage errorMessage">
                Erreur lors du chargement des profils.
            </p>
        `;

        console.error(erreur);
    }
}
