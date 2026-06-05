const express = require("express");

let nodemailer = null;

try {
    nodemailer = require("nodemailer");
} catch (error) {
    nodemailer = null;
}

const router = express.Router();

const REQUIRED_MAIL_CONFIG = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "CONTACT_RECIPIENT_EMAIL"
];

function getStringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

function getMissingMailConfig() {
    return REQUIRED_MAIL_CONFIG.filter((key) => {
        return !process.env[key];
    });
}

function buildTransporter() {
    if (!nodemailer) {
        return null;
    }

    const missingMailConfig = getMissingMailConfig();

    if (missingMailConfig.length > 0) {
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        }
    });
}

router.post("/", async (req, res) => {
    const name = getStringValue(req.body.name);
    const email = getStringValue(req.body.email);
    const subject = getStringValue(req.body.subject);
    const message = getStringValue(req.body.message);
    const missingMailConfig = getMissingMailConfig();

    if (!name || !email || !subject || !message) {
        return res.status(400).json({
            message: "Merci de remplir tous les champs du formulaire."
        });
    }

    if (!email.includes("@")) {
        return res.status(400).json({
            message: "Adresse email invalide."
        });
    }

    if (!nodemailer) {
        return res.status(503).json({
            message: "Le service de contact n'est pas encore disponible sur ce serveur.",
            missing: ["nodemailer"]
        });
    }

    if (missingMailConfig.length > 0) {
        return res.status(503).json({
            message: "Configuration email incomplete. Renseignez les variables SMTP dans backend/.env.",
            missing: missingMailConfig
        });
    }

    try {
        const transporter = buildTransporter();

        await transporter.sendMail({
            from: process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER,
            to: process.env.CONTACT_RECIPIENT_EMAIL,
            replyTo: email,
            subject: `[HandiRepere] ${subject}`,
            text: [
                "Nouveau message depuis la page contact HandiRepere",
                "",
                `Nom : ${name}`,
                `Email : ${email}`,
                `Objet : ${subject}`,
                "",
                "Message :",
                message
            ].join("\n")
        });

        return res.status(201).json({
            message: "Votre message a bien ete envoye."
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Impossible d'envoyer votre message pour le moment."
        });
    }
});

module.exports = router;
