const doctorConfig = require("../../shared/doctorConfig");
const { pool } = require("../db");

let doctorAvailabilityTablePromise;

function getDefaultAvailabilityEntries(doctorKey) {
    return doctorConfig.weeklyDayOrder.flatMap((dayOfWeek) => {
        const timeSlots = doctorConfig.weeklyAvailabilityTemplate[dayOfWeek] || [];

        return timeSlots.map((timeSlot) => {
            return {
                doctorKey,
                dayOfWeek,
                isAvailable: true,
                timeSlot
            };
        });
    });
}

async function ensureDoctorAvailabilityTable() {
    if (!pool) {
        return;
    }

    if (!doctorAvailabilityTablePromise) {
        doctorAvailabilityTablePromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS doctor_availability (
                    id SERIAL PRIMARY KEY,
                    doctor_key VARCHAR(255) NOT NULL,
                    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
                    time_slot TIME NOT NULL,
                    is_available BOOLEAN NOT NULL DEFAULT TRUE,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (doctor_key, day_of_week, time_slot)
                )
            `);
        })().catch((error) => {
            doctorAvailabilityTablePromise = undefined;
            throw error;
        });
    }

    return doctorAvailabilityTablePromise;
}

async function ensureDoctorAvailabilitySeed(doctorKey) {
    if (!pool || !doctorKey) {
        return;
    }

    await ensureDoctorAvailabilityTable();

    const entries = getDefaultAvailabilityEntries(doctorKey);

    if (entries.length === 0) {
        return;
    }

    const placeholders = entries.map((entry, index) => {
        const startIndex = index * 4;
        return `($${startIndex + 1}, $${startIndex + 2}, $${startIndex + 3}, $${startIndex + 4})`;
    }).join(", ");

    const values = entries.flatMap((entry) => {
        return [
            entry.doctorKey,
            entry.dayOfWeek,
            `${entry.timeSlot}:00`,
            entry.isAvailable
        ];
    });

    await pool.query(
        `
            INSERT INTO doctor_availability (
                doctor_key,
                day_of_week,
                time_slot,
                is_available
            )
            VALUES ${placeholders}
            ON CONFLICT (doctor_key, day_of_week, time_slot) DO NOTHING
        `,
        values
    );
}

async function getDoctorWeeklyAvailability(doctorKey) {
    if (!pool || !doctorKey) {
        return [];
    }

    await ensureDoctorAvailabilitySeed(doctorKey);

    const result = await pool.query(
        `
            SELECT
                day_of_week,
                TO_CHAR(time_slot, 'HH24:MI') AS time_slot,
                is_available
            FROM doctor_availability
            WHERE doctor_key = $1
            ORDER BY day_of_week ASC, time_slot ASC
        `,
        [doctorKey]
    );

    return result.rows.map((row) => {
        return {
            dayOfWeek: row.day_of_week,
            isAvailable: row.is_available,
            timeSlot: row.time_slot
        };
    });
}

async function isDoctorSlotAvailable(doctorKey, dayOfWeek, timeSlot) {
    if (!pool || !doctorKey) {
        return false;
    }

    await ensureDoctorAvailabilitySeed(doctorKey);

    const result = await pool.query(
        `
            SELECT is_available
            FROM doctor_availability
            WHERE doctor_key = $1
            AND day_of_week = $2
            AND time_slot = $3
        `,
        [doctorKey, dayOfWeek, `${timeSlot}:00`]
    );

    return result.rowCount > 0 && result.rows[0].is_available === true;
}

async function updateDoctorSlotAvailability(doctorKey, dayOfWeek, timeSlot, isAvailable) {
    if (!pool || !doctorKey) {
        return;
    }

    await ensureDoctorAvailabilitySeed(doctorKey);

    await pool.query(
        `
            INSERT INTO doctor_availability (
                doctor_key,
                day_of_week,
                time_slot,
                is_available,
                updated_at
            )
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (doctor_key, day_of_week, time_slot)
            DO UPDATE SET
                is_available = EXCLUDED.is_available,
                updated_at = CURRENT_TIMESTAMP
        `,
        [doctorKey, dayOfWeek, `${timeSlot}:00`, isAvailable]
    );
}

module.exports = {
    ensureDoctorAvailabilitySeed,
    ensureDoctorAvailabilityTable,
    getDoctorWeeklyAvailability,
    isDoctorSlotAvailable,
    updateDoctorSlotAvailability
};
