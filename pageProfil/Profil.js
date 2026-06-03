const FALLBACK_TEXT = "Information non renseignee";

function getSearchValue(searchParams, key, fallback = "") {
    const value = searchParams.get(key);
    return value && value.trim() ? value.trim() : fallback;
}

function getDisplayValue(value, fallback = FALLBACK_TEXT) {
    return value || fallback;
}

function formatMetaLocation(city, postalCode) {
    return [city, postalCode].filter(Boolean).join(" ") || FALLBACK_TEXT;
}

function formatMetaRegion(region) {
    return region || FALLBACK_TEXT;
}

function setContactLink(element, value, hrefValue = "") {
    element.textContent = getDisplayValue(value);

    if (value && hrefValue) {
        element.href = hrefValue;
        element.classList.remove("isMuted");
        return;
    }

    element.removeAttribute("href");
    element.classList.add("isMuted");
}

function getAppointmentUrl(searchParams) {
    const appointmentParams = new URLSearchParams({
        doctorKey: getSearchValue(searchParams, "doctorKey"),
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
        return `http://localhost:3000/pageProfil/pagePrendreRdv/PrendreRdvPage.html?${appointmentParams.toString()}`;
    }

    return `/pageProfil/pagePrendreRdv/PrendreRdvPage.html?${appointmentParams.toString()}`;
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
    document.getElementById("doctorCabinet").textContent = getDisplayValue(cabinetName);
    document.getElementById("doctorCityMeta").textContent = formatMetaLocation(city, postalCode);
    document.getElementById("doctorRegionMeta").textContent = formatMetaRegion(region);
    document.getElementById("cabinetName").textContent = getDisplayValue(cabinetName);
    document.getElementById("cabinetAddress").textContent = getDisplayValue(address);
    document.getElementById("doctorCity").textContent = getDisplayValue(city);
    document.getElementById("doctorPostalCode").textContent = getDisplayValue(postalCode);
    document.getElementById("doctorRegion").textContent = getDisplayValue(region);
    document.getElementById("doctorCountry").textContent = getDisplayValue(country);

    const professionalEmailLink = document.getElementById("professionalEmail");
    setContactLink(
        professionalEmailLink,
        professionalEmail,
        professionalEmail ? `mailto:${professionalEmail}` : ""
    );

    const doctorPhoneLink = document.getElementById("doctorPhone");
    setContactLink(
        doctorPhoneLink,
        phone,
        phone ? `tel:${phone.replace(/\s+/g, "")}` : ""
    );

    document.getElementById("appointmentLink").href = getAppointmentUrl(searchParams);
    profileContent.hidden = false;
});
