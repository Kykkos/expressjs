// api/server.js
import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import 'dotenv/config'; // Pour charger les variables d'environnement localement

const app = express();
const port = process.env.PORT || 3001;

// Configuration de la connexion à la base de données
// Utilise la variable d'environnement DATABASE_URL que vous avez configurée sur Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- Middleware ---

// 1. CORS : Autorise les requêtes de votre frontend
// Il est préférable de définir l'origine exacte de votre frontend pour une sécurité maximale
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(cors({
    origin: frontendUrl,
    optionsSuccessStatus: 200
}));

// Route de test simple
app.get('/', (req, res) => {
  res.send('API PostgreSQL en cours d\'exécution.');
});

// Fonction utilitaire pour exécuter les requêtes
async function fetchData(query, params = []) {
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        return result.rows;
    } finally {
        client.release();
    }
}

// --- Endpoints d'API ---

// 1. GET /api/transcriptions/all : Récupère TOUTES les transcriptions.
app.get('/api/transcriptions/all', async (req, res) => {
    try {
        const sql = `
            SELECT id, user_id, start_date, end_date, language, transcription_text, created_at, status
            FROM transcriptions
            ORDER BY created_at DESC;
        `;
        const data = await fetchData(sql);
        res.json(data);
    } catch (error) {
        console.error('Erreur lors de la récupération de toutes les transcriptions:', error);
        res.status(500).json({ error: 'Erreur serveur interne' });
    }
});


// 2. GET /api/transcriptions/live?from={ISO_DATE}&to={ISO_DATE} : Transcriptions filtrées par date.
app.get('/api/transcriptions/live', async (req, res) => {
    const { from, to } = req.query; // Récupère les paramètres 'from' et 'to' de l'URL

    let sql = `
        SELECT id, user_id, start_date, end_date, language, transcription_text, created_at, status
        FROM transcriptions
        WHERE status = 'live'
    `;
    const params = [];

    // Ajout des filtres de date si les paramètres sont présents
    if (from) {
        params.push(from);
        sql += ` AND created_at >= $${params.length}`; // $1
    }
    if (to) {
        params.push(to);
        sql += ` AND created_at <= $${params.length}`; // $2 (ou $1 si 'from' n'est pas là)
    }
    
    sql += ` ORDER BY created_at DESC;`;

    try {
        const data = await fetchData(sql, params);
        res.json(data);
    } catch (error) {
        console.error('Erreur lors de la récupération des transcriptions live filtrées:', error);
        res.status(500).json({ error: 'Erreur serveur interne' });
    }
});

// Endpoint useBillingData (gardé pour référence)
app.get('/api/billing', async (req, res) => {
    try {
        const sql = `
            SELECT 
                user_id, 
                COUNT(id) AS total_transcriptions, 
                SUM(EXTRACT(EPOCH FROM (end_date - start_date))) AS total_duration_seconds
            FROM transcriptions
            GROUP BY user_id
            ORDER BY total_duration_seconds DESC;
        `;
        const data = await fetchData(sql);
        res.json(data);
    } catch (error) {
        console.error('Erreur lors de la récupération des données de facturation:', error);
        res.status(500).json({ error: 'Erreur serveur interne' });
    }
});


// Démarrage du serveur
app.listen(port, () => {
  console.log(`Serveur API démarré sur le port ${port}`);
});
