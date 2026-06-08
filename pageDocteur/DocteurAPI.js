const doctorConfig = window.HANDIREPERE_DOCTOR_CONFIG || {
    doctorKey: "medecin-louis-coda",
    managedDoctorIndex: 0,
    publicDoctorProfile: {
        cabinetName: "Cabinet du Dr Ortega",
        firstName: "Louis",
        lastName: "Ortega",
        professionalEmail: "louis.ortega@coda-student.school"
    },
    randomUserResults: 5,
    randomUserSeed: "handirepere-medecins"
};

let doctorsDirectory = [];

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("doctorSearchInput");

    searchInput.addEventListener("input", () => {
        renderDoctors(searchInput.value);
    });

    chargerMedecins();
});

function getProfileBaseUrl() {
    if (window.location.protocol === "file:") {
        return "http://localhost:3000/pageProfil/Profil.html";
    }

    return "/pageProfil/Profil.html";
}

function getDoctorKey(personne, index) {
    if (index === doctorConfig.managedDoctorIndex) {
        return doctorConfig.doctorKey.toLowerCase();
    }

    return personne.email.toLowerCase();
}

function getManagedDoctorProfile(personne) {
    return {
        address: `${personne.location.street.number} ${personne.location.street.name}`,
        cabinet: doctorConfig.publicDoctorProfile.cabinetName,
        city: personne.location.city,
        country: personne.location.country,
        doctorKey: doctorConfig.doctorKey.toLowerCase(),
        fullName: `Dr ${doctorConfig.publicDoctorProfile.firstName} ${doctorConfig.publicDoctorProfile.lastName}`,
        phone: personne.phone,
        photo: personne.picture.large,
        postalCode: String(personne.location.postcode),
        professionalEmail: doctorConfig.publicDoctorProfile.professionalEmail,
        region: personne.location.state
    };
}

function getDoctorProfile(personne, index) {
    if (index === doctorConfig.managedDoctorIndex) {
        return getManagedDoctorProfile(personne);
    }

    return {
        address: `${personne.location.street.number} ${personne.location.street.name}`,
        cabinet: `Cabinet du Dr ${personne.name.last}`,
        city: personne.location.city,
        country: personne.location.country,
        doctorKey: getDoctorKey(personne, index),
        fullName: `Dr ${personne.name.first} ${personne.name.last}`,
        phone: personne.phone,
        photo: personne.picture.large,
        postalCode: String(personne.location.postcode),
        professionalEmail: personne.email,
        region: personne.location.state
    };
}

function buildProfileUrl(doctorProfile) {
    const params = new URLSearchParams({
        doctorKey: doctorProfile.doctorKey,
        fullName: doctorProfile.fullName,
        photo: doctorProfile.photo,
        cabinet: doctorProfile.cabinet,
        professionalEmail: doctorProfile.professionalEmail,
        phone: doctorProfile.phone,
        address: doctorProfile.address,
        city: doctorProfile.city,
        postalCode: doctorProfile.postalCode,
        region: doctorProfile.region,
        country: doctorProfile.country
    });

    return `${getProfileBaseUrl()}?${params.toString()}`;
}

function buildDoctorCard(doctorProfile) {
    return `
        <article class="medecin">
            <div class="medecinHeader">
                <img class="medecinPhoto" src="${doctorProfile.photo}" alt="Photo du médecin">
                <div class="medecinIdentity">
                    <p class="medecinLabel">Profil disponible</p>
                    <h2 class="medecinNom">
                        ${doctorProfile.fullName}
                    </h2>
                    <p class="medecinLieu">
                        ${doctorProfile.city}, ${doctorProfile.country}
                    </p>
                </div>
            </div>
            <div class="medecinDetails">
                <p>
                    <span>Cabinet</span>
                    ${doctorProfile.cabinet}
                </p>
                <p>
                    <span>Téléphone</span>
                    <a href="tel:${doctorProfile.phone}">${doctorProfile.phone}</a>
                </p>
                <p>
                    <span>Email</span>
                    <a href="mailto:${doctorProfile.professionalEmail}">${doctorProfile.professionalEmail}</a>
                </p>
            </div>
            <div class="medecinActions">
                <a class="profileLink" href="${buildProfileUrl(doctorProfile)}">
                    Voir le profil
                </a>
            </div>
        </article>
    `;
}

function normalizeSearchValue(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function matchesSearch(doctorProfile, searchValue) {
    if (!searchValue) {
        return true;
    }

    const searchableContent = [
        doctorProfile.fullName,
        doctorProfile.cabinet,
        doctorProfile.city,
        doctorProfile.region,
        doctorProfile.professionalEmail
    ].join(" ").toLowerCase();

    return searchableContent.includes(searchValue);
}

function renderDoctors(searchQuery = "") {
    const resultats = document.getElementById("resultats");
    const normalizedSearchQuery = normalizeSearchValue(searchQuery);
    const filteredDoctors = doctorsDirectory.filter((doctorProfile) => {
        return matchesSearch(doctorProfile, normalizedSearchQuery);
    });

    if (filteredDoctors.length === 0) {
        resultats.innerHTML = `
            <p class="statusMessage">
                Aucun medecin ne correspond a votre recherche.
            </p>
        `;
        return;
    }

    resultats.innerHTML = filteredDoctors.map((doctorProfile) => {
        return buildDoctorCard(doctorProfile);
    }).join("");
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
            `https://randomuser.me/api/?results=${doctorConfig.randomUserResults}&seed=${doctorConfig.randomUserSeed}`
        );

        const donnees = await reponse.json();

        doctorsDirectory = donnees.results.map((personne, index) => {
            return getDoctorProfile(personne, index);
        });

        renderDoctors(document.getElementById("doctorSearchInput").value);

    } catch(error){

        resultats.innerHTML = `
            <p class="statusMessage errorMessage">
                Erreur lors du chargement des profils.
            </p>
        `;

        console.error(error);
    }
}
