function getApiBaseUrl() {
    return window.location.protocol === "file:" ? "http://localhost:3000" : "";
}

function getHomeUrl() {
    const pathname = window.location.pathname.replace(/\\/g, "/");

    if (window.location.protocol !== "file:") {
        return "/pageAccueil/index.html";
    }

    return pathname.includes("/pageAccueil/") ? "index.html" : "../pageAccueil/index.html";
}

function getLoginUrl() {
    const pathname = window.location.pathname.replace(/\\/g, "/");

    if (window.location.protocol !== "file:") {
        return "/pageConnection/Connection/pageConnection.html";
    }

    return pathname.includes("/pageConnection/") ? "Connection/pageConnection.html" : "../pageConnection/Connection/pageConnection.html";
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

        const data = await response.json();
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
    let sessionUser;

    clearLegacyAuthState();

    logoutButtons.forEach((button) => {
        button.hidden = true;
    });

    sessionUser = await getSessionUser();

    if (requireAuth && !sessionUser) {
        if (hasLogoutGuard()) {
            redirectTo(getPostLogoutUrl());
            return;
        }

        redirectTo(getLoginUrl());
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
