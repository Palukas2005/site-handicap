function getApiBaseUrl() {
    return window.location.protocol === "file:" ? "http://localhost:3000" : "";
}

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

function getProjectRootFileUrl() {
    const pathname = window.location.pathname.replace(/\\/g, "/");
    const knownFolders = [
        "/pageProfil/pagePrendreRdv/",
        "/pageConnection/Medecin/",
        "/pageConnection/Connection/",
        "/pageConnection/Inscription/",
        "/pageAccueil/",
        "/pageDocteur/",
        "/pageMedecin/",
        "/pageRdv/",
        "/pageProfil/"
    ];
    const matchingFolder = knownFolders.find((folder) => {
        return pathname.includes(folder);
    });

    if (matchingFolder) {
        const projectRootPath = pathname.slice(0, pathname.indexOf(matchingFolder) + 1);
        return new URL(`file://${projectRootPath}`);
    }

    return new URL(".", window.location.href);
}

function getHomeUrl() {
    if (window.location.protocol !== "file:") {
        return "/pageAccueil/index.html";
    }

    return new URL("pageAccueil/index.html", getProjectRootFileUrl()).href;
}

function getLoginUrl() {
    if (window.location.protocol !== "file:") {
        return "/pageConnection/Connection/pageConnection.html";
    }

    return new URL("pageConnection/Connection/pageConnection.html", getProjectRootFileUrl()).href;
}

function getDoctorLoginUrl() {
    if (window.location.protocol !== "file:") {
        return "/pageConnection/Medecin/pageConnectionMedecin.html";
    }

    return new URL("pageConnection/Medecin/pageConnectionMedecin.html", getProjectRootFileUrl()).href;
}

function getPatientSpaceUrl() {
    if (window.location.protocol !== "file:") {
        return "/pageDocteur/Docteur.html";
    }

    return new URL("pageDocteur/Docteur.html", getProjectRootFileUrl()).href;
}

function getDoctorSpaceUrl() {
    if (window.location.protocol !== "file:") {
        return "/pageMedecin/EspaceMedecin.html";
    }

    return new URL("pageMedecin/EspaceMedecin.html", getProjectRootFileUrl()).href;
}

function getPostLogoutUrl() {
    return "https://www.google.com/";
}

const LOGOUT_GUARD_KEY = "logout_back_guard";
let logoutGuardBound = false;
let logoutGuardPrimed = false;

function redirectTo(url) {
    window.location.replace(url);
}

function setLogoutGuard() {
    try {
        sessionStorage.setItem(LOGOUT_GUARD_KEY, "true");
    } catch (error) {
        console.error(error);
    }
}

function hasLogoutGuard() {
    try {
        return sessionStorage.getItem(LOGOUT_GUARD_KEY) === "true";
    } catch (error) {
        console.error(error);
        return false;
    }
}

function clearLogoutGuard() {
    try {
        sessionStorage.removeItem(LOGOUT_GUARD_KEY);
        logoutGuardPrimed = false;
    } catch (error) {
        console.error(error);
    }
}

function handleLogoutGuardPopState() {
    if (!hasLogoutGuard()) {
        return;
    }

    window.history.pushState({ logoutGuard: true }, "", window.location.href);
    redirectTo(getPostLogoutUrl());
}

function ensureLogoutGuard() {
    if (!hasLogoutGuard()) {
        return;
    }

    if (!logoutGuardBound) {
        window.addEventListener("popstate", handleLogoutGuardPopState);
        logoutGuardBound = true;
    }

    if (!logoutGuardPrimed) {
        window.history.pushState({ logoutGuard: true }, "", window.location.href);
        logoutGuardPrimed = true;
    }
}

function clearLegacyAuthState() {
    try {
        localStorage.removeItem("currentUser");
    } catch (error) {
        console.error(error);
    }
}

async function getSessionUser() {
    try {
        const response = await fetch(`${getApiBaseUrl()}/api/users/me`, {
            method: "GET",
            credentials: "include"
        });

        if (response.status === 401) {
            return null;
        }

        if (!response.ok) {
            throw new Error("Impossible de recuperer la session utilisateur.");
        }

        const responseText = await response.text();
        const data = parseApiResponse(responseText);
        return data.user || null;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function logout() {
    try {
        await fetch(`${getApiBaseUrl()}/api/users/logout`, {
            method: "POST",
            credentials: "include"
        });
    } catch (error) {
        console.error(error);
    } finally {
        setLogoutGuard();
        clearLegacyAuthState();
        redirectTo(getHomeUrl());
    }
}

async function syncAuthState() {
    const logoutButtons = document.querySelectorAll("[data-logout-button]");
    const requireAuth = document.body.dataset.requireAuth === "true";
    const requiredRole = document.body.dataset.requireRole || "";
    let sessionUser;

    clearLegacyAuthState();

    logoutButtons.forEach((button) => {
        button.hidden = true;
    });

    sessionUser = await getSessionUser();

    if (requireAuth && !sessionUser) {
        if (hasLogoutGuard() && requiredRole !== "doctor") {
            redirectTo(getPostLogoutUrl());
            return;
        }

        redirectTo(requiredRole === "doctor" ? getDoctorLoginUrl() : getLoginUrl());
        return;
    }

    if (requireAuth && requiredRole && sessionUser && sessionUser.role !== requiredRole) {
        redirectTo(sessionUser.role === "doctor" ? getDoctorSpaceUrl() : getPatientSpaceUrl());
        return;
    }

    if (sessionUser) {
        clearLogoutGuard();
    } else {
        ensureLogoutGuard();
    }

    logoutButtons.forEach((button) => {
        button.hidden = !sessionUser;

        if (sessionUser && button.dataset.logoutBound !== "true") {
            button.addEventListener("click", logout);
            button.dataset.logoutBound = "true";
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    syncAuthState();
});

window.addEventListener("pageshow", () => {
    syncAuthState();
});
