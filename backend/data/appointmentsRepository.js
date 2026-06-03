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
                    appointment_date DATE NOT NULL,
                    appointment_time TIME NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (doctor_key, appointment_date, appointment_time)
                )
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
