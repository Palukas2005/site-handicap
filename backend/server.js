const express = require("express");
const path = require("node:path");
const cors = require("cors");
const { pool, missingDbConfig } = require("./db");
const { requirePageAuth } = require("./auth");
const usersRouter = require("./routes/users");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use("/api/users", usersRouter);
app.use(["/pageDocteur", "/pageRdv", "/pageProfil"], requirePageAuth);
app.use(express.static(path.resolve(__dirname, "..")));

app.get("/api/db-status", async (req, res) => {
    if (!pool) {
        return res.status(503).json({
            message: "Configuration PostgreSQL incomplète.",
            missing: missingDbConfig
        });
    }

    try {

        const result = await pool.query("SELECT NOW()");

        res.json({
            message: "Connexion PostgreSQL réussie",
            date: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Erreur de connexion à PostgreSQL"
        });

    }

});

app.get("/", (req, res) => {
    res.redirect("/pageAccueil/index.html");
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Serveur lancé sur le port ${port}`);
    });
}

module.exports = app;
