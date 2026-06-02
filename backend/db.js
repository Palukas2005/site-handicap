const path = require("node:path");
const { Pool } = require("pg");

require("dotenv").config({
    path: path.resolve(__dirname, ".env")
});

const requiredDbConfig = [
    "DB_USER",
    "DB_HOST",
    "DB_NAME",
    "DB_PASSWORD",
    "DB_PORT"
];

const missingDbConfig = requiredDbConfig.filter((key) => {
    return !process.env[key];
});

const pool = missingDbConfig.length === 0
    ? new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT)
    })
    : null;

module.exports = {
    pool,
    missingDbConfig
};
