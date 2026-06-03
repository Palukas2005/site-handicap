const express = require("express");
const { getSession } = require("../auth");
const { pool, missingDbConfig } = require("../db");
const { ensureAppointmentsTable } = require("../data/appointmentsRepository");

const router = express.Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function getAuthenticatedSession(req) {
    return getSession(req);
}

function normalizeDoctorKey(doctorKey) {
    return typeof doctorKey === "string" ? doctorKey.trim().toLowerCase() : "";
}

function getStringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

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
                    appointment_date,
                    appointment_time
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING
                    id,
                    doctor_name,
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
                appointmentDate,
                `${appointmentTime}:00`
            ]
        );

        return res.status(201).json({
            message: "Rendez-vous enregistre avec succes.",
            appointment: {
                id: result.rows[0].id,
                doctorName: result.rows[0].doctor_name,
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
