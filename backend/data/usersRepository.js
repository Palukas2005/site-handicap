const bcrypt = require("bcrypt");
const { pool } = require("../db");

let usersTablePromise;

async function ensureUsersTable() {
    if (!pool) {
        return;
    }

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

module.exports = {
    ensureUsersTable
};
