const { pool } = require("../db");

let appointmentsTablePromise;

async function ensureAppointmentsTable() {
    if (!pool) {
        return;
    }

    if (!appointmentsTablePromise) {
        appointmentsTablePromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS appointments (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    doctor_key VARCHAR(255) NOT NULL,
                    doctor_name VARCHAR(255) NOT NULL,
                    doctor_email VARCHAR(255),
                    doctor_cabinet VARCHAR(255),
                    doctor_city VARCHAR(255),
                    doctor_region VARCHAR(255),
                    duration_minutes INTEGER NOT NULL DEFAULT 60,
                    appointment_date DATE NOT NULL,
                    appointment_time TIME NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (doctor_key, appointment_date, appointment_time)
                )
            `);

            await pool.query(`
                ALTER TABLE appointments
                ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60
            `);

            await pool.query(`
                UPDATE appointments
                SET duration_minutes = 60
                WHERE duration_minutes IS NULL OR duration_minutes <= 0
            `);
        })().catch((error) => {
            appointmentsTablePromise = undefined;
            throw error;
        });
    }

    return appointmentsTablePromise;
}

module.exports = {
    ensureAppointmentsTable
};
