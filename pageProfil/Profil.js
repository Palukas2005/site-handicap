function getSearchValue(searchParams, key, fallback = "Information a venir") {
    const value = searchParams.get(key);
    return value && value.trim() ? value.trim() : fallback;
}

function getAppointmentUrl(searchParams) {
    const appointmentParams = new URLSearchParams({
        doctorKey: getSearchValue(searchParams, "doctorKey", ""),
        fullName: getSearchValue(searchParams, "fullName"),
        cabinet: getSearchValue(searchParams, "cabinet"),
        professionalEmail: getSearchValue(searchParams, "professionalEmail"),
        phone: getSearchValue(searchParams, "phone"),
        address: getSearchValue(searchParams, "address"),
        city: getSearchValue(searchParams, "city"),
        postalCode: getSearchValue(searchParams, "postalCode"),
        region: getSearchValue(searchParams, "region"),
        country: getSearchValue(searchParams, "country"),
        photo: searchParams.get("photo") || "../OIP.jpeg"
    });

    if (window.location.protocol === "file:") {
        return `http://localhost:3000/pageProfil/pagePrendreRdv/PrendreRdv.html?${appointmentParams.toString()}`;
    }

    return `/pageProfil/pagePrendreRdv/PrendreRdv.html?${appointmentParams.toString()}`;
}

document.addEventListener("DOMContentLoaded", () => {
    const searchParams = new URLSearchParams(window.location.search);
    const fullName = searchParams.get("fullName");
    const profileContent = document.getElementById("profileContent");
    const emptyState = document.getElementById("profileEmptyState");

    if (!fullName) {
        emptyState.hidden = false;
        return;
    }

    const doctorName = getSearchValue(searchParams, "fullName");
    const cabinetName = getSearchValue(searchParams, "cabinet");
    const address = getSearchValue(searchParams, "address");
    const city = getSearchValue(searchParams, "city");
    const postalCode = getSearchValue(searchParams, "postalCode");
    const region = getSearchValue(searchParams, "region");
    const country = getSearchValue(searchParams, "country");
    const professionalEmail = getSearchValue(searchParams, "professionalEmail");
    const phone = getSearchValue(searchParams, "phone");
    const photo = searchParams.get("photo") || "../OIP.jpeg";

    document.title = `${doctorName} - Profil`;
    document.getElementById("doctorPhoto").src = photo;
    document.getElementById("doctorPhoto").alt = `Photo de ${doctorName}`;
    document.getElementById("doctorName").textContent = doctorName;
    document.getElementById("doctorCabinet").textContent = cabinetName;
    document.getElementById("doctorCityMeta").textContent = `${city} ${postalCode}`;
    document.getElementById("doctorRegionMeta").textContent = region;
    document.getElementById("cabinetName").textContent = cabinetName;
    document.getElementById("cabinetAddress").textContent = address;
    document.getElementById("doctorCity").textContent = city;
    document.getElementById("doctorPostalCode").textContent = postalCode;
    document.getElementById("doctorRegion").textContent = region;
    document.getElementById("doctorCountry").textContent = country;

    const professionalEmailLink = document.getElementById("professionalEmail");
    professionalEmailLink.textContent = professionalEmail;
    professionalEmailLink.href = `mailto:${professionalEmail}`;

    const doctorPhoneLink = document.getElementById("doctorPhone");
    doctorPhoneLink.textContent = phone;
    doctorPhoneLink.href = `tel:${phone}`;

    document.getElementById("appointmentLink").href = getAppointmentUrl(searchParams);
    profileContent.hidden = false;
});
