const crypto = require("node:crypto");

const SESSION_COOKIE_NAME = "handirepere_session";
const sessions = new Map();

function parseCookies(cookieHeader = "") {
    return cookieHeader.split(";").reduce((cookies, cookiePart) => {
        const trimmedCookie = cookiePart.trim();

        if (!trimmedCookie) {
            return cookies;
        }

        const separatorIndex = trimmedCookie.indexOf("=");

        if (separatorIndex === -1) {
            return cookies;
        }

        const key = trimmedCookie.slice(0, separatorIndex);
        const value = trimmedCookie.slice(separatorIndex + 1);

        cookies[key] = decodeURIComponent(value);
        return cookies;
    }, {});
}

function getSessionToken(req) {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[SESSION_COOKIE_NAME];
}

function getSession(req) {
    const token = getSessionToken(req);

    if (!token) {
        return null;
    }

    return sessions.get(token) || null;
}

function createSession(user) {
    const token = crypto.randomBytes(32).toString("hex");

    sessions.set(token, {
        id: user.id,
        email: user.email,
        createdAt: Date.now()
    });

    return token;
}

function deleteSession(token) {
    if (token) {
        sessions.delete(token);
    }
}

function setSessionCookie(res, token) {
    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`
    );
}

function clearSessionCookie(res) {
    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    );
}

function requirePageAuth(req, res, next) {
    if (getSession(req)) {
        next();
        return;
    }

    res.redirect("/pageConnection/Connection/pageConnection.html");
}

module.exports = {
    clearSessionCookie,
    createSession,
    deleteSession,
    getSession,
    getSessionToken,
    requirePageAuth,
    setSessionCookie
};
