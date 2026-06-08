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
const { pool, missingDbConfig } = require("../db");

const router = express.Router();

let usersTablePromise;

async function ensureUsersTable() {
    if (!usersTablePromise) {
        usersTablePromise = (async () => {
            await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

            await pool.query(`
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS password TEXT
            `);

            await pool.query(`
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS password_hash TEXT
            `);

            await pool.query(`
                ALTER TABLE users
                ALTER COLUMN password DROP NOT NULL
            `);

            const legacyUsers = await pool.query(`
                SELECT id, password
                FROM users
                WHERE password_hash IS NULL
                AND password IS NOT NULL
            `);

            for (const legacyUser of legacyUsers.rows) {
                const passwordHash = await bcrypt.hash(legacyUser.password, 10);

                await pool.query(
                    "UPDATE users SET password_hash = $1, password = NULL WHERE id = $2",
                    [passwordHash, legacyUser.id]
                );
            }
        })().catch((error) => {
            usersTablePromise = undefined;
            throw error;
        });
    }

    return usersTablePromise;
}

function getNormalizedEmail(email) {
    return typeof email === "string" ? email.trim().toLowerCase() : "";
}

router.get("/me", (req, res) => {
    const session = getSession(req);

    if (!session) {
        return res.status(401).json({
            message: "Non authentifie."
        });
    }

    return res.json({
        user: {
            id: session.id,
            email: session.email,
            role: session.role || "patient",
            name: session.name || ""
        }
    });
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

        const deletedUser = await pool.query(
            "DELETE FROM users WHERE id = $1 AND email = $2 RETURNING id",
            [session.id, getNormalizedEmail(session.email)]
        );

        if (deletedUser.rowCount === 0) {
            return res.status(404).json({
                message: "Compte introuvable."
            });
        }

        if (sessionToken) {
            deleteSession(sessionToken);
            clearSessionCookie(res);
        }

        return res.json({
            message: "Compte supprimé avec succès."
        });
    } catch (error) {
        console.error(error);

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
            "INSERT INTO users (email, password_hash) VALUES ($1, $2)",
            [email, passwordHash]
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
            "SELECT id, email, password, password_hash FROM users WHERE email = $1",
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
            name: user.email
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
