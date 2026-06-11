const express = require("express");
const doctorConfig = require("../../shared/doctorConfig");
const { getSession } = require("../auth");
const {
    getDoctorSlotSettings,
    getDoctorWeeklyAvailability
} = require("../data/doctorAvailabilityRepository");
const { ensureUsersTable } = require("../data/usersRepository");
const { pool, missingDbConfig } = require("../db");
const { ensureAppointmentsTable } = require("../data/appointmentsRepository");

const router = express.Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function getAuthenticatedSession(req) {
    return getSession(req);
}

function getAuthenticatedDoctorSession(req) {
    const session = getAuthenticatedSession(req);

    if (!session || session.role !== "doctor") {
        return null;
    }

    return session;
}

function normalizeDoctorKey(doctorKey) {
    return typeof doctorKey === "string" ? doctorKey.trim().toLowerCase() : "";
}

function getStringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

function isValidDurationMinutes(durationMinutes) {
    return Number.isInteger(durationMinutes)
        && doctorConfig.appointmentDurationOptions.includes(durationMinutes);
}

function getAppointmentDayOfWeek(dateString) {
    if (!DATE_PATTERN.test(dateString)) {
        return null;
    }

    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.getDay();
}

router.delete("/:appointmentId", async (req, res) => {
    const session = getAuthenticatedSession(req);
    const appointmentId = Number(req.params.appointmentId);

    if (!session) {
        return res.status(401).json({
            message: "Non authentifie."
        });
    }

    if (!pool) {
        return res.status(503).json({
            message: "Configuration PostgreSQL incomplète. Renseignez backend/.env avant d'utiliser l'authentification.",
            missing: missingDbConfig
        });
    }

    if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
        return res.status(400).json({
            message: "Rendez-vous invalide."
        });
    }

    try {
        await ensureAppointmentsTable();

        const result = await pool.query(
            `
                DELETE FROM appointments
                WHERE id = $1 AND user_id = $2
                RETURNING id
            `,
            [appointmentId, session.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: "Rendez-vous introuvable."
            });
        }

        return res.json({
            message: "Rendez-vous supprime avec succes."
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de supprimer ce rendez-vous pour le moment."
        });
    }
});

router.get("/mine", async (req, res) => {
    const session = getAuthenticatedSession(req);

    if (!session) {
        return res.status(401).json({
            message: "Non authentifie."
        });
    }

    if (!pool) {
        return res.status(503).json({
            message: "Configuration PostgreSQL incomplète. Renseignez backend/.env avant d'utiliser l'authentification.",
            missing: missingDbConfig
        });
    }

    try {
        await ensureAppointmentsTable();

        const result = await pool.query(
            `
                SELECT
                    id,
                    doctor_name,
                    doctor_email,
                    doctor_cabinet,
                    doctor_city,
                    doctor_region,
                    duration_minutes,
                    appointment_date::text AS appointment_date,
                    TO_CHAR(appointment_time, 'HH24:MI') AS appointment_time,
                    created_at
                FROM appointments
                WHERE user_id = $1
                ORDER BY appointment_date ASC, appointment_time ASC
            `,
            [session.id]
        );

        return res.json({
            appointments: result.rows.map((row) => {
                return {
                    id: row.id,
                    doctorName: row.doctor_name,
                    doctorEmail: row.doctor_email,
                    doctorCabinet: row.doctor_cabinet,
                    doctorCity: row.doctor_city,
                    doctorRegion: row.doctor_region,
                    durationMinutes: row.duration_minutes,
                    appointmentDate: row.appointment_date,
                    appointmentTime: row.appointment_time,
                    createdAt: row.created_at
                };
            })
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de charger les rendez-vous pour le moment."
        });
    }
});

router.get("/doctor", async (req, res) => {
    const session = getAuthenticatedDoctorSession(req);

    if (!session) {
        return res.status(401).json({
            message: "Non authentifie."
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
        await ensureAppointmentsTable();

        const doctorKey = normalizeDoctorKey(session.doctorKey || doctorConfig.doctorKey);

        const result = await pool.query(
            `
                SELECT
                    appointments.id,
                    users.email AS patient_email,
                    appointments.duration_minutes,
                    appointments.appointment_date::text AS appointment_date,
                    TO_CHAR(appointments.appointment_time, 'HH24:MI') AS appointment_time,
                    appointments.created_at
                FROM appointments
                LEFT JOIN users
                    ON users.id = appointments.user_id
                WHERE appointments.doctor_key = $1
                ORDER BY appointments.appointment_date ASC, appointments.appointment_time ASC
            `,
            [doctorKey]
        );

        return res.json({
            appointments: result.rows.map((row) => {
                return {
                    id: row.id,
                    durationMinutes: row.duration_minutes,
                    patientEmail: row.patient_email || "Patient non renseigne",
                    appointmentDate: row.appointment_date,
                    appointmentTime: row.appointment_time,
                    createdAt: row.created_at
                };
            })
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de charger les rendez-vous du medecin pour le moment."
        });
    }
});

router.put("/doctor/:appointmentId/duration", async (req, res) => {
    const session = getAuthenticatedDoctorSession(req);
    const appointmentId = Number(req.params.appointmentId);
    const durationMinutes = Number(req.body.durationMinutes);

    if (!session) {
        return res.status(401).json({
            message: "Non authentifie."
        });
    }

    if (!pool) {
        return res.status(503).json({
            message: "Configuration PostgreSQL incomplète. Renseignez backend/.env avant d'utiliser l'authentification.",
            missing: missingDbConfig
        });
    }

    if (!Number.isInteger(appointmentId) || appointmentId <= 0 || !isValidDurationMinutes(durationMinutes)) {
        return res.status(400).json({
            message: "Rendez-vous medecin invalide."
        });
    }

    try {
        await ensureAppointmentsTable();

        const doctorKey = normalizeDoctorKey(session.doctorKey || doctorConfig.doctorKey);
        const result = await pool.query(
            `
                UPDATE appointments
                SET duration_minutes = $1
                WHERE id = $2
                AND doctor_key = $3
                RETURNING
                    id,
                    duration_minutes,
                    appointment_date::text AS appointment_date,
                    TO_CHAR(appointment_time, 'HH24:MI') AS appointment_time
            `,
            [durationMinutes, appointmentId, doctorKey]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: "Rendez-vous introuvable."
            });
        }

        return res.json({
            message: "Duree du rendez-vous mise a jour.",
            appointment: {
                id: result.rows[0].id,
                durationMinutes: result.rows[0].duration_minutes,
                appointmentDate: result.rows[0].appointment_date,
                appointmentTime: result.rows[0].appointment_time
            }
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de modifier la duree de ce rendez-vous pour le moment."
        });
    }
});

router.get("/availability", async (req, res) => {
    const session = getAuthenticatedSession(req);
    const doctorKey = normalizeDoctorKey(req.query.doctorKey);

    if (!session) {
        return res.status(401).json({
            message: "Non authentifie."
        });
    }

    if (!pool) {
        return res.status(503).json({
            message: "Configuration PostgreSQL incomplète. Renseignez backend/.env avant d'utiliser l'authentification.",
            missing: missingDbConfig
        });
    }

    if (!doctorKey) {
        return res.status(400).json({
            message: "Medecin invalide."
        });
    }

    try {
        await ensureAppointmentsTable();
        const weeklyAvailability = await getDoctorWeeklyAvailability(doctorKey);

        const result = await pool.query(
            `
                SELECT
                    appointment_date::text AS appointment_date,
                    TO_CHAR(appointment_time, 'HH24:MI') AS appointment_time
                FROM appointments
                WHERE doctor_key = $1
                AND appointment_date >= CURRENT_DATE
                ORDER BY appointment_date, appointment_time
            `,
            [doctorKey]
        );

        return res.json({
            weeklyAvailability,
            weeklyDayOrder: doctorConfig.weeklyDayOrder,
            weeklyTimeSlots: doctorConfig.weeklyTimeSlots,
            unavailableSlots: result.rows.map((row) => {
                return {
                    appointmentDate: row.appointment_date,
                    appointmentTime: row.appointment_time
                };
            })
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de charger les disponibilites pour le moment."
        });
    }
});

router.post("/", async (req, res) => {
    const session = getAuthenticatedSession(req);
    const doctorKey = normalizeDoctorKey(req.body.doctorKey);
    const doctorName = getStringValue(req.body.doctorName);
    const doctorEmail = getStringValue(req.body.doctorEmail);
    const doctorCabinet = getStringValue(req.body.doctorCabinet);
    const doctorCity = getStringValue(req.body.doctorCity);
    const doctorRegion = getStringValue(req.body.doctorRegion);
    const appointmentDate = getStringValue(req.body.appointmentDate);
    const appointmentTime = getStringValue(req.body.appointmentTime);

    if (!session) {
        return res.status(401).json({
            message: "Non authentifie."
        });
    }

    if (!pool) {
        return res.status(503).json({
            message: "Configuration PostgreSQL incomplète. Renseignez backend/.env avant d'utiliser l'authentification.",
            missing: missingDbConfig
        });
    }

    if (!doctorKey || !doctorName || !DATE_PATTERN.test(appointmentDate) || !TIME_PATTERN.test(appointmentTime)) {
        return res.status(400).json({
            message: "Rendez-vous invalide."
        });
    }

    try {
        await ensureAppointmentsTable();

        const appointmentDayOfWeek = getAppointmentDayOfWeek(appointmentDate);

        if (appointmentDayOfWeek === null) {
            return res.status(400).json({
                message: "Date de rendez-vous invalide."
            });
        }

        const slotSettings = await getDoctorSlotSettings(
            doctorKey,
            appointmentDayOfWeek,
            appointmentTime
        );

        if (!slotSettings.isAvailable) {
            return res.status(409).json({
                message: "Ce creneau n'est pas disponible dans le planning du medecin."
            });
        }

        const result = await pool.query(
            `
                INSERT INTO appointments (
                    user_id,
                    doctor_key,
                    doctor_name,
                    doctor_email,
                    doctor_cabinet,
                    doctor_city,
                    doctor_region,
                    duration_minutes,
                    appointment_date,
                    appointment_time
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING
                    id,
                    doctor_name,
                    duration_minutes,
                    appointment_date::text AS appointment_date,
                    TO_CHAR(appointment_time, 'HH24:MI') AS appointment_time
            `,
            [
                session.id,
                doctorKey,
                doctorName,
                doctorEmail || null,
                doctorCabinet || null,
                doctorCity || null,
                doctorRegion || null,
                slotSettings.durationMinutes,
                appointmentDate,
                `${appointmentTime}:00`
            ]
        );

        return res.status(201).json({
            message: "Rendez-vous enregistre avec succes.",
            appointment: {
                id: result.rows[0].id,
                doctorName: result.rows[0].doctor_name,
                durationMinutes: result.rows[0].duration_minutes,
                appointmentDate: result.rows[0].appointment_date,
                appointmentTime: result.rows[0].appointment_time
            }
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                message: "Ce creneau vient d'etre reserve. Choisissez-en un autre."
            });
        }

        console.error(error);

        return res.status(500).json({
            message: "Impossible d'enregistrer ce rendez-vous pour le moment."
        });
    }
});

module.exports = router;
