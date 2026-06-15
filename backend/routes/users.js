const express = require("express");
const bcrypt = require("bcrypt");
const {
    clearSessionCookie,
    createSession,
    deleteSession,
    getSession,
    getSessionToken,
    setSessionCookie
} = require("../auth");
const { ensureAppointmentsTable } = require("../data/appointmentsRepository");
const { ensureUsersTable } = require("../data/usersRepository");
const { pool, missingDbConfig } = require("../db");

const router = express.Router();

function getNormalizedEmail(email) {
    return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function getStringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

function hasOwn(body, key) {
    return Object.prototype.hasOwnProperty.call(body, key);
}

function buildDisplayName(firstName, lastName, fallback = "") {
    const fullName = [firstName, lastName]
        .map((value) => getStringValue(value))
        .filter(Boolean)
        .join(" ");

    return fullName || fallback;
}

function buildSessionUserResponse(session, userOverrides = {}) {
    const firstName = getStringValue(userOverrides.firstName);
    const lastName = getStringValue(userOverrides.lastName);
    const fallbackName = getStringValue(userOverrides.name || session.name || session.email);

    return {
        id: session.id,
        email: userOverrides.email || session.email,
        role: userOverrides.role || session.role || "patient",
        name: buildDisplayName(firstName, lastName, fallbackName),
        firstName,
        lastName,
        emailNotificationsEnabled: typeof userOverrides.emailNotificationsEnabled === "boolean"
            ? userOverrides.emailNotificationsEnabled
            : true,
        appointmentRemindersEnabled: typeof userOverrides.appointmentRemindersEnabled === "boolean"
            ? userOverrides.appointmentRemindersEnabled
            : true
    };
}

router.get("/me", async (req, res) => {
    const session = getSession(req);

    if (!session) {
        return res.status(401).json({
            message: "Non authentifie."
        });
    }

    if (session.role === "doctor" || !pool) {
        return res.json({
            user: buildSessionUserResponse(session)
        });
    }

    try {
        await ensureUsersTable();

        const result = await pool.query(
            `
                SELECT
                    id,
                    email,
                    first_name,
                    last_name,
                    email_notifications_enabled,
                    appointment_reminders_enabled
                FROM users
                WHERE id = $1
            `,
            [session.id]
        );

        if (result.rowCount === 0) {
            return res.json({
                user: buildSessionUserResponse(session)
            });
        }

        const user = result.rows[0];

        return res.json({
            user: buildSessionUserResponse(session, {
                appointmentRemindersEnabled: user.appointment_reminders_enabled,
                email: user.email,
                emailNotificationsEnabled: user.email_notifications_enabled,
                firstName: user.first_name,
                lastName: user.last_name,
                name: buildDisplayName(user.first_name, user.last_name, session.email)
            })
        });
    } catch (error) {
        console.error(error);
    }

    return res.json({
        user: buildSessionUserResponse(session)
    });
});

router.put("/me", async (req, res) => {
    const session = getSession(req);

    if (!session) {
        return res.status(401).json({
            message: "Non authentifie."
        });
    }

    if (session.role === "doctor") {
        return res.status(403).json({
            message: "Cette route est reservee aux comptes patients."
        });
    }

    if (!pool) {
        return res.status(503).json({
            message: "Configuration PostgreSQL incomplète. Renseignez backend/.env avant d'utiliser l'authentification.",
            missing: missingDbConfig
        });
    }

    try {
        await ensureUsersTable();

        const currentUserResult = await pool.query(
            `
                SELECT
                    id,
                    email,
                    first_name,
                    last_name,
                    email_notifications_enabled,
                    appointment_reminders_enabled
                FROM users
                WHERE id = $1
            `,
            [session.id]
        );

        if (currentUserResult.rowCount === 0) {
            return res.status(404).json({
                message: "Compte introuvable."
            });
        }

        const currentUser = currentUserResult.rows[0];
        const firstName = hasOwn(req.body, "firstName")
            ? getStringValue(req.body.firstName)
            : (currentUser.first_name || "");
        const lastName = hasOwn(req.body, "lastName")
            ? getStringValue(req.body.lastName)
            : (currentUser.last_name || "");
        const emailNotificationsEnabled = typeof req.body.emailNotificationsEnabled === "boolean"
            ? req.body.emailNotificationsEnabled
            : currentUser.email_notifications_enabled;
        const appointmentRemindersEnabled = typeof req.body.appointmentRemindersEnabled === "boolean"
            ? req.body.appointmentRemindersEnabled
            : currentUser.appointment_reminders_enabled;

        const updatedUserResult = await pool.query(
            `
                UPDATE users
                SET
                    first_name = $1,
                    last_name = $2,
                    email_notifications_enabled = $3,
                    appointment_reminders_enabled = $4
                WHERE id = $5
                RETURNING
                    id,
                    email,
                    first_name,
                    last_name,
                    email_notifications_enabled,
                    appointment_reminders_enabled
            `,
            [
                firstName || null,
                lastName || null,
                emailNotificationsEnabled,
                appointmentRemindersEnabled,
                session.id
            ]
        );

        const updatedUser = updatedUserResult.rows[0];

        return res.json({
            message: "Profil patient mis a jour avec succes.",
            user: buildSessionUserResponse(session, {
                appointmentRemindersEnabled: updatedUser.appointment_reminders_enabled,
                email: updatedUser.email,
                emailNotificationsEnabled: updatedUser.email_notifications_enabled,
                firstName: updatedUser.first_name,
                lastName: updatedUser.last_name,
                name: buildDisplayName(updatedUser.first_name, updatedUser.last_name, updatedUser.email)
            })
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de mettre a jour le profil pour le moment."
        });
    }
});

router.delete("/me", async (req, res) => {
    const session = getSession(req);
    const sessionToken = getSessionToken(req);

    if (!pool) {
        return res.status(503).json({
            message: "Configuration PostgreSQL incomplète. Renseignez backend/.env avant d'utiliser l'authentification.",
            missing: missingDbConfig
        });
    }

    if (!session) {
        return res.status(401).json({
            message: "Non authentifie."
        });
    }

    try {
        await ensureUsersTable();
        await ensureAppointmentsTable();

        await pool.query("BEGIN");

        await pool.query(
            "DELETE FROM appointments WHERE user_id = $1",
            [session.id]
        );

        const deletedUser = await pool.query(
            "DELETE FROM users WHERE id = $1 AND email = $2 RETURNING id",
            [session.id, getNormalizedEmail(session.email)]
        );

        if (deletedUser.rowCount === 0) {
            await pool.query("ROLLBACK");
            return res.status(404).json({
                message: "Compte introuvable."
            });
        }

        await pool.query("COMMIT");

        if (sessionToken) {
            deleteSession(sessionToken);
            clearSessionCookie(res);
        }

        return res.json({
            message: "Compte supprimé avec succès."
        });
    } catch (error) {
        console.error(error);

        try {
            await pool.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(rollbackError);
        }

        return res.status(500).json({
            message: "Impossible de supprimer le compte pour le moment."
        });
    }
});

router.post("/logout", (req, res) => {
    const sessionToken = getSessionToken(req);

    deleteSession(sessionToken);
    clearSessionCookie(res);

    return res.json({
        message: "Déconnexion réussie."
    });
});

router.post("/register", async (req, res) => {
    const email = getNormalizedEmail(req.body.email);
    const firstName = getStringValue(req.body.firstName);
    const lastName = getStringValue(req.body.lastName);
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!pool) {
        return res.status(503).json({
            message: "Configuration PostgreSQL incomplète. Renseignez backend/.env avant d'utiliser l'authentification.",
            missing: missingDbConfig
        });
    }

    if (!email || !password) {
        return res.status(400).json({
            message: "Email et mot de passe obligatoires."
        });
    }

    try {
        await ensureUsersTable();

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rowCount > 0) {
            return res.status(409).json({
                message: "Ce compte existe déjà."
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query(
            `
                INSERT INTO users (
                    email,
                    password_hash,
                    first_name,
                    last_name
                )
                VALUES ($1, $2, $3, $4)
            `,
            [
                email,
                passwordHash,
                firstName || null,
                lastName || null
            ]
        );

        return res.status(201).json({
            message: "Compte créé avec succès."
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de créer le compte pour le moment."
        });
    }
});

router.post("/login", async (req, res) => {
    const email = getNormalizedEmail(req.body.email);
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!pool) {
        return res.status(503).json({
            message: "Configuration PostgreSQL incomplète. Renseignez backend/.env avant d'utiliser l'authentification.",
            missing: missingDbConfig
        });
    }

    if (!email || !password) {
        return res.status(400).json({
            message: "Email et mot de passe obligatoires."
        });
    }

    try {
        await ensureUsersTable();

        const result = await pool.query(
            `
                SELECT
                    id,
                    email,
                    password,
                    password_hash,
                    first_name,
                    last_name
                FROM users
                WHERE email = $1
            `,
            [email]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                message: "Email ou mot de passe incorrect."
            });
        }

        const user = result.rows[0];
        const passwordMatches = user.password_hash
            ? await bcrypt.compare(password, user.password_hash)
            : password === user.password;

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Email ou mot de passe incorrect."
            });
        }

        if (!user.password_hash && user.password) {
            const passwordHash = await bcrypt.hash(user.password, 10);

            await pool.query(
                "UPDATE users SET password_hash = $1, password = NULL WHERE id = $2",
                [passwordHash, user.id]
            );
        }

        const sessionToken = createSession({
            id: user.id,
            email: user.email,
            name: buildDisplayName(user.first_name, user.last_name, user.email)
        }, "patient");

        setSessionCookie(res, sessionToken);

        return res.json({
            message: "Connexion réussie.",
            user: {
                id: user.id,
                email: user.email
            }
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de se connecter pour le moment."
        });
    }
});

module.exports = router;
