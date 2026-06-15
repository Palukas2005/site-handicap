const express = require("express");
const bcrypt = require("bcrypt");
const doctorConfig = require("../../shared/doctorConfig");
const {
    clearSessionCookie,
    createSession,
    deleteSession,
    getSession,
    getSessionToken,
    setSessionCookie
} = require("../auth");
const { ensureAppointmentsTable } = require("../data/appointmentsRepository");
const {
    ensureDoctorAvailabilitySeed,
    ensureDoctorAvailabilityTable,
    getDoctorSlotSettings,
    getDoctorWeeklyAvailability,
    updateDoctorSlotAvailability
} = require("../data/doctorAvailabilityRepository");
const { pool, missingDbConfig } = require("../db");

const router = express.Router();

let doctorsTablePromise;

async function ensureDoctorsTable() {
    if (!doctorsTablePromise) {
        doctorsTablePromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS doctors (
                    id SERIAL PRIMARY KEY,
                    full_name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    doctor_key VARCHAR(255),
                    password_hash TEXT NOT NULL,
                    specialty VARCHAR(255),
                    cabinet_name VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                ALTER TABLE doctors
                ADD COLUMN IF NOT EXISTS specialty VARCHAR(255)
            `);

            await pool.query(`
                ALTER TABLE doctors
                ADD COLUMN IF NOT EXISTS cabinet_name VARCHAR(255)
            `);

            await pool.query(`
                ALTER TABLE doctors
                ADD COLUMN IF NOT EXISTS doctor_key VARCHAR(255)
            `);

            await pool.query(`
                ALTER TABLE doctors
                ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)
            `);

            await pool.query(`
                ALTER TABLE doctors
                ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)
            `);

            await pool.query(`
                ALTER TABLE doctors
                ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE
            `);

            await pool.query(`
                ALTER TABLE doctors
                ADD COLUMN IF NOT EXISTS appointment_reminders_enabled BOOLEAN DEFAULT TRUE
            `);

            await pool.query(`
                UPDATE doctors
                SET doctor_key = $1
                WHERE LOWER(email) = $2
            `, [
                doctorConfig.doctorKey,
                doctorConfig.doctorAccountEmail.toLowerCase()
            ]);

            await pool.query(`
                UPDATE doctors
                SET doctor_key = LOWER(email)
                WHERE doctor_key IS NULL OR doctor_key = ''
            `);

            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS doctors_doctor_key_unique
                ON doctors (doctor_key)
            `);
        })().catch((error) => {
            doctorsTablePromise = undefined;
            throw error;
        });
    }

    return doctorsTablePromise;
}

function getNormalizedEmail(email) {
    return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function getStringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

function hasOwn(body, key) {
    return Object.prototype.hasOwnProperty.call(body, key);
}

function splitFullName(fullName) {
    const normalizedFullName = getStringValue(fullName);

    if (!normalizedFullName) {
        return {
            firstName: "",
            lastName: ""
        };
    }

    const nameParts = normalizedFullName.split(/\s+/);

    return {
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ")
    };
}

function buildFullName(firstName, lastName, fallback = doctorConfig.doctorDisplayName) {
    const fullName = [firstName, lastName]
        .map((value) => getStringValue(value))
        .filter(Boolean)
        .join(" ");

    return fullName || getStringValue(fallback) || doctorConfig.doctorDisplayName;
}

function getDoctorSession(req) {
    const session = getSession(req);

    if (!session || session.role !== "doctor") {
        return null;
    }

    return session;
}

function isConfiguredDoctorEmail(email) {
    return email === doctorConfig.doctorAccountEmail.toLowerCase();
}

function isValidDayOfWeek(value) {
    return Number.isInteger(value) && value >= 0 && value <= 6;
}

function isValidTimeSlot(timeSlot) {
    return doctorConfig.weeklyTimeSlots.includes(timeSlot);
}

function isValidDurationMinutes(durationMinutes) {
    return Number.isInteger(durationMinutes)
        && doctorConfig.appointmentDurationOptions.includes(durationMinutes);
}

router.get("/me", async (req, res) => {
    const session = getDoctorSession(req);

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
        await ensureDoctorsTable();

        const result = await pool.query(
            `
                SELECT
                    id,
                    full_name,
                    first_name,
                    last_name,
                    email,
                    specialty,
                    cabinet_name,
                    doctor_key,
                    email_notifications_enabled,
                    appointment_reminders_enabled
                FROM doctors
                WHERE id = $1
            `,
            [session.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: "Medecin introuvable."
            });
        }

        const doctor = result.rows[0];
        const derivedNames = splitFullName(doctor.full_name);

        return res.json({
            doctor: {
                appointmentRemindersEnabled: typeof doctor.appointment_reminders_enabled === "boolean"
                    ? doctor.appointment_reminders_enabled
                    : true,
                id: doctor.id,
                firstName: doctor.first_name || derivedNames.firstName,
                fullName: doctor.full_name,
                doctorKey: doctor.doctor_key,
                displayName: doctorConfig.doctorDisplayName,
                email: doctor.email,
                emailNotificationsEnabled: typeof doctor.email_notifications_enabled === "boolean"
                    ? doctor.email_notifications_enabled
                    : true,
                lastName: doctor.last_name || derivedNames.lastName,
                specialty: doctor.specialty,
                cabinetName: doctor.cabinet_name,
                role: "doctor"
            }
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de recuperer le profil medecin pour le moment."
        });
    }
});

router.put("/me", async (req, res) => {
    const session = getDoctorSession(req);

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
        await ensureDoctorsTable();

        const currentDoctorResult = await pool.query(
            `
                SELECT
                    id,
                    full_name,
                    first_name,
                    last_name,
                    email,
                    specialty,
                    cabinet_name,
                    doctor_key,
                    email_notifications_enabled,
                    appointment_reminders_enabled
                FROM doctors
                WHERE id = $1
            `,
            [session.id]
        );

        if (currentDoctorResult.rowCount === 0) {
            return res.status(404).json({
                message: "Medecin introuvable."
            });
        }

        const currentDoctor = currentDoctorResult.rows[0];
        const currentDerivedNames = splitFullName(currentDoctor.full_name);
        const firstName = hasOwn(req.body, "firstName")
            ? getStringValue(req.body.firstName)
            : (currentDoctor.first_name || currentDerivedNames.firstName);
        const lastName = hasOwn(req.body, "lastName")
            ? getStringValue(req.body.lastName)
            : (currentDoctor.last_name || currentDerivedNames.lastName);
        const specialty = hasOwn(req.body, "specialty")
            ? getStringValue(req.body.specialty)
            : (currentDoctor.specialty || "");
        const cabinetName = hasOwn(req.body, "cabinetName")
            ? getStringValue(req.body.cabinetName)
            : (currentDoctor.cabinet_name || "");
        const emailNotificationsEnabled = typeof req.body.emailNotificationsEnabled === "boolean"
            ? req.body.emailNotificationsEnabled
            : currentDoctor.email_notifications_enabled;
        const appointmentRemindersEnabled = typeof req.body.appointmentRemindersEnabled === "boolean"
            ? req.body.appointmentRemindersEnabled
            : currentDoctor.appointment_reminders_enabled;
        const fullName = buildFullName(firstName, lastName, currentDoctor.full_name);

        const updatedDoctorResult = await pool.query(
            `
                UPDATE doctors
                SET
                    full_name = $1,
                    first_name = $2,
                    last_name = $3,
                    specialty = $4,
                    cabinet_name = $5,
                    email_notifications_enabled = $6,
                    appointment_reminders_enabled = $7
                WHERE id = $8
                RETURNING
                    id,
                    full_name,
                    first_name,
                    last_name,
                    email,
                    specialty,
                    cabinet_name,
                    doctor_key,
                    email_notifications_enabled,
                    appointment_reminders_enabled
            `,
            [
                fullName,
                firstName || null,
                lastName || null,
                specialty || null,
                cabinetName || null,
                emailNotificationsEnabled,
                appointmentRemindersEnabled,
                session.id
            ]
        );

        const updatedDoctor = updatedDoctorResult.rows[0];

        return res.json({
            message: "Profil medecin mis a jour avec succes.",
            doctor: {
                appointmentRemindersEnabled: typeof updatedDoctor.appointment_reminders_enabled === "boolean"
                    ? updatedDoctor.appointment_reminders_enabled
                    : true,
                id: updatedDoctor.id,
                firstName: updatedDoctor.first_name || "",
                fullName: updatedDoctor.full_name,
                doctorKey: updatedDoctor.doctor_key,
                displayName: doctorConfig.doctorDisplayName,
                email: updatedDoctor.email,
                emailNotificationsEnabled: typeof updatedDoctor.email_notifications_enabled === "boolean"
                    ? updatedDoctor.email_notifications_enabled
                    : true,
                lastName: updatedDoctor.last_name || "",
                specialty: updatedDoctor.specialty,
                cabinetName: updatedDoctor.cabinet_name,
                role: "doctor"
            }
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de mettre a jour le profil medecin pour le moment."
        });
    }
});

router.delete("/me", async (req, res) => {
    const session = getDoctorSession(req);
    const sessionToken = getSessionToken(req);

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
        await ensureDoctorsTable();
        await ensureAppointmentsTable();
        await ensureDoctorAvailabilityTable();

        await pool.query("BEGIN");

        await pool.query(
            "DELETE FROM appointments WHERE doctor_key = $1",
            [session.doctorKey || doctorConfig.doctorKey]
        );

        await pool.query(
            "DELETE FROM doctor_availability WHERE doctor_key = $1",
            [session.doctorKey || doctorConfig.doctorKey]
        );

        const deletedDoctor = await pool.query(
            "DELETE FROM doctors WHERE id = $1 AND email = $2 RETURNING id",
            [session.id, getNormalizedEmail(session.email)]
        );

        if (deletedDoctor.rowCount === 0) {
            await pool.query("ROLLBACK");
            return res.status(404).json({
                message: "Compte medecin introuvable."
            });
        }

        await pool.query("COMMIT");

        if (sessionToken) {
            deleteSession(sessionToken);
            clearSessionCookie(res);
        }

        return res.json({
            message: "Compte medecin supprime avec succes."
        });
    } catch (error) {
        console.error(error);

        try {
            await pool.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(rollbackError);
        }

        return res.status(500).json({
            message: "Impossible de supprimer le compte medecin pour le moment."
        });
    }
});

router.post("/register", async (req, res) => {
    const fullName = getStringValue(req.body.fullName);
    const email = getNormalizedEmail(req.body.email);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const specialty = getStringValue(req.body.specialty);
    const cabinetName = getStringValue(req.body.cabinetName);
    const nameParts = splitFullName(fullName);

    if (!pool) {
        return res.status(503).json({
            message: "Configuration PostgreSQL incomplète. Renseignez backend/.env avant d'utiliser l'authentification.",
            missing: missingDbConfig
        });
    }

    if (!fullName || !email || !password) {
        return res.status(400).json({
            message: "Nom, email et mot de passe obligatoires."
        });
    }

    if (!isConfiguredDoctorEmail(email)) {
        return res.status(400).json({
            message: `Utilisez l'email medecin prevu : ${doctorConfig.doctorAccountEmail}.`
        });
    }

    try {
        await ensureDoctorsTable();

        const existingDoctor = await pool.query(
            "SELECT id FROM doctors WHERE email = $1",
            [email]
        );

        if (existingDoctor.rowCount > 0) {
            return res.status(409).json({
                message: "Ce compte medecin existe deja."
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query(
            `
                INSERT INTO doctors (
                    full_name,
                    first_name,
                    last_name,
                    email,
                    doctor_key,
                    password_hash,
                    specialty,
                    cabinet_name
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
                fullName,
                nameParts.firstName || null,
                nameParts.lastName || null,
                email,
                doctorConfig.doctorKey,
                passwordHash,
                specialty || null,
                cabinetName || null
            ]
        );

        await ensureDoctorAvailabilitySeed(doctorConfig.doctorKey);

        return res.status(201).json({
            message: "Compte medecin cree avec succes."
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de creer le compte medecin pour le moment."
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

    if (!isConfiguredDoctorEmail(email)) {
        return res.status(401).json({
            message: "Email ou mot de passe medecin incorrect."
        });
    }

    try {
        await ensureDoctorsTable();

        const result = await pool.query(
            `
                SELECT
                    id,
                    full_name,
                    first_name,
                    last_name,
                    email,
                    doctor_key,
                    password_hash,
                    specialty,
                    cabinet_name
                FROM doctors
                WHERE email = $1
            `,
            [email]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                message: "Email ou mot de passe medecin incorrect."
            });
        }

        const doctor = result.rows[0];
        const passwordMatches = await bcrypt.compare(password, doctor.password_hash);

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Email ou mot de passe medecin incorrect."
            });
        }

        const sessionToken = createSession({
            id: doctor.id,
            doctorKey: doctor.doctor_key || doctorConfig.doctorKey,
            email: doctor.email,
            name: buildFullName(doctor.first_name, doctor.last_name, doctor.full_name)
        }, "doctor");

        setSessionCookie(res, sessionToken);
        await ensureDoctorAvailabilitySeed(doctor.doctor_key || doctorConfig.doctorKey);

        return res.json({
            message: "Connexion medecin reussie.",
            doctor: {
                id: doctor.id,
                firstName: doctor.first_name || splitFullName(doctor.full_name).firstName,
                fullName: doctor.full_name,
                doctorKey: doctor.doctor_key || doctorConfig.doctorKey,
                displayName: doctorConfig.doctorDisplayName,
                email: doctor.email,
                lastName: doctor.last_name || splitFullName(doctor.full_name).lastName,
                specialty: doctor.specialty,
                cabinetName: doctor.cabinet_name,
                role: "doctor"
            }
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de connecter le medecin pour le moment."
        });
    }
});

router.get("/availability", async (req, res) => {
    const session = getDoctorSession(req);

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
        await ensureDoctorsTable();

        const doctorKey = session.doctorKey || doctorConfig.doctorKey;
        const weeklyAvailability = await getDoctorWeeklyAvailability(doctorKey);

        return res.json({
            doctorKey,
            appointmentDurationOptions: doctorConfig.appointmentDurationOptions,
            defaultAppointmentDurationMinutes: doctorConfig.defaultAppointmentDurationMinutes,
            weeklyAvailability,
            weeklyDayOrder: doctorConfig.weeklyDayOrder,
            weeklyTimeSlots: doctorConfig.weeklyTimeSlots
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de charger le planning medecin pour le moment."
        });
    }
});

router.put("/availability", async (req, res) => {
    const session = getDoctorSession(req);
    const dayOfWeek = Number(req.body.dayOfWeek);
    const timeSlot = getStringValue(req.body.timeSlot);
    const requestedDurationMinutes = Number(req.body.durationMinutes);
    const isAvailable = req.body.isAvailable;

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

    if (
        !isValidDayOfWeek(dayOfWeek)
        || !isValidTimeSlot(timeSlot)
        || typeof isAvailable !== "boolean"
    ) {
        return res.status(400).json({
            message: "Creneau medecin invalide."
        });
    }

    try {
        const doctorKey = session.doctorKey || doctorConfig.doctorKey;
        const currentSlotSettings = await getDoctorSlotSettings(doctorKey, dayOfWeek, timeSlot);
        const durationMinutes = isValidDurationMinutes(requestedDurationMinutes)
            ? requestedDurationMinutes
            : currentSlotSettings.durationMinutes;

        await updateDoctorSlotAvailability(doctorKey, dayOfWeek, timeSlot, isAvailable, durationMinutes);

        return res.json({
            message: "Planning medecin mis a jour.",
            slot: {
                dayOfWeek,
                durationMinutes,
                isAvailable,
                timeSlot
            }
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible de mettre a jour ce creneau pour le moment."
        });
    }
});

module.exports = router;
