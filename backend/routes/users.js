const express = require("express");
const bcrypt = require("bcrypt");
const { pool, missingDbConfig } = require("../db");

const router = express.Router();

let usersTablePromise;

function ensureUsersTable() {
    if (!usersTablePromise) {
        usersTablePromise = pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `).catch((error) => {
            usersTablePromise = undefined;
            throw error;
        });
    }

    return usersTablePromise;
}

function getNormalizedEmail(email) {
    return typeof email === "string" ? email.trim().toLowerCase() : "";
}

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
            "SELECT id, email, password_hash FROM users WHERE email = $1",
            [email]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                message: "Email ou mot de passe incorrect."
            });
        }

        const user = result.rows[0];
        const passwordMatches = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Email ou mot de passe incorrect."
            });
        }

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
