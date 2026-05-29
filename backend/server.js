const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {

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

app.listen(3000, () => {
    console.log("Serveur lancé sur le port 3000");
});