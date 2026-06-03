document.addEventListener("DOMContentLoaded", () => {
    chargerMedecins();
});

function getProfileBaseUrl() {
    if (window.location.protocol === "file:") {
        return "http://localhost:3000/pageProfil/Profil.html";
    }

    return "/pageProfil/Profil.html";
}

function buildProfileUrl(personne) {
    const params = new URLSearchParams({
        fullName: `Dr ${personne.name.first} ${personne.name.last}`,
        photo: personne.picture.large,
        cabinet: `Cabinet du Dr ${personne.name.last}`,
        professionalEmail: personne.email,
        phone: personne.phone,
        address: `${personne.location.street.number} ${personne.location.street.name}`,
        city: personne.location.city,
        postalCode: String(personne.location.postcode),
        region: personne.location.state,
        country: personne.location.country
    });

    return `${getProfileBaseUrl()}?${params.toString()}`;
}

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
                    <div class="medecinActions">
                        <a class="profileLink" href="${buildProfileUrl(personne)}">
                            Voir le profil
                        </a>
                    </div>
                </article>
            `;
        }).join("");

    } catch(error){

        resultats.innerHTML = `
            <p class="statusMessage errorMessage">
                Erreur lors du chargement des profils.
            </p>
        `;

        console.error(error);
    }
}
