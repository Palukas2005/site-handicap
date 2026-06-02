function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem("currentUser"));
    } catch (error) {
        console.error(error);
        return null;
    }
}

function getHomeUrl() {
    const pathname = window.location.pathname.replace(/\\/g, "/");

    if (window.location.protocol !== "file:") {
        return "/pageAccueil/index.html";
    }

    return pathname.includes("/pageAccueil/") ? "index.html" : "../pageAccueil/index.html";
}

function logout() {
    localStorage.removeItem("currentUser");
    window.location.href = getHomeUrl();
}

document.addEventListener("DOMContentLoaded", () => {
    const currentUser = getCurrentUser();
    const logoutButtons = document.querySelectorAll("[data-logout-button]");

    logoutButtons.forEach((button) => {
        button.hidden = !currentUser;

        if (currentUser) {
            button.addEventListener("click", logout);
        }
    });
});
