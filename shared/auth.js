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
        clearLegacyAuthState();
        window.location.href = getHomeUrl();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const logoutButtons = document.querySelectorAll("[data-logout-button]");
    const requireAuth = document.body.dataset.requireAuth === "true";
    let sessionUser;

    clearLegacyAuthState();

    logoutButtons.forEach((button) => {
        button.hidden = true;
    });

    sessionUser = await getSessionUser();

    if (requireAuth && !sessionUser) {
        window.location.href = getLoginUrl();
        return;
    }

    logoutButtons.forEach((button) => {
        button.hidden = !sessionUser;

        if (sessionUser) {
            button.addEventListener("click", () => {
                logout();
            });
        }
    });
});
