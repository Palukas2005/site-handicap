const express = require("express");
const bcrypt = require("bcrypt");
const doctorConfig = require("../../shared/doctorConfig");
const {
    createSession,
    getSession,
    setSessionCookie
} = require("../auth");
const {
    ensureDoctorAvailabilitySeed,
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
                SELECT id, full_name, email, specialty, cabinet_name, doctor_key
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

        return res.json({
            doctor: {
                id: doctor.id,
                fullName: doctor.full_name,
                doctorKey: doctor.doctor_key,
                displayName: doctorConfig.doctorDisplayName,
                email: doctor.email,
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

router.post("/register", async (req, res) => {
    const fullName = getStringValue(req.body.fullName);
    const email = getNormalizedEmail(req.body.email);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const specialty = getStringValue(req.body.specialty);
    const cabinetName = getStringValue(req.body.cabinetName);

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
                    email,
                    doctor_key,
                    password_hash,
                    specialty,
                    cabinet_name
                )
                VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
                fullName,
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
                SELECT id, full_name, email, doctor_key, password_hash, specialty, cabinet_name
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
            name: doctor.full_name
        }, "doctor");

        setSessionCookie(res, sessionToken);
        await ensureDoctorAvailabilitySeed(doctor.doctor_key || doctorConfig.doctorKey);

        return res.json({
            message: "Connexion medecin reussie.",
            doctor: {
                id: doctor.id,
                fullName: doctor.full_name,
                doctorKey: doctor.doctor_key || doctorConfig.doctorKey,
                displayName: doctorConfig.doctorDisplayName,
                email: doctor.email,
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

    if (!isValidDayOfWeek(dayOfWeek) || !isValidTimeSlot(timeSlot) || typeof isAvailable !== "boolean") {
        return res.status(400).json({
            message: "Creneau medecin invalide."
        });
    }

    try {
        const doctorKey = session.doctorKey || doctorConfig.doctorKey;

        await updateDoctorSlotAvailability(doctorKey, dayOfWeek, timeSlot, isAvailable);

        return res.json({
            message: "Planning medecin mis a jour.",
            slot: {
                dayOfWeek,
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
