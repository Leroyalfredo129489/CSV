require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const FormData = require('form-data');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3000;

// Inicialización de base de datos SQL "temporal"
const db = new sqlite3.Database(path.join(__dirname, 'data.db'));
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS ads (id INTEGER PRIMARY KEY AUTOINCREMENT, advertiser TEXT, description TEXT, longevity INTEGER, trust_score REAL, media_url TEXT, pfp_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

const upload = multer({ dest: 'uploads/' });


app.use(express.static(path.join(__dirname)));


app.get('/ping-n8n', async (req, res) => {
    try {
        const url = process.env.WEBHOOK_URL;
        if (!url) return res.json({ status: 'offline' });
        await axios.get(url, { timeout: 10000 });
        res.json({ status: 'online' });
    } catch (error) {
        const status = error.response ? error.response.status : null;
        if (status === 200 || status === 405 || status === 401 || status === 403) {
            res.json({ status: 'online' });
        } else {
            res.json({ status: 'offline' });
        }
    }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Committing analyzed intelligence to SQL
app.post('/system/data/commit', (req, res) => {
    const { ads } = req.body;
    if (!ads || !Array.isArray(ads)) return res.status(400).send('Bad Request');

    const stmt = db.prepare("INSERT INTO ads (advertiser, description, longevity, trust_score, media_url, pfp_url) VALUES (?, ?, ?, ?, ?, ?)");

    db.serialize(() => {
        ads.forEach(ad => {
            stmt.run(
                ad.row['Anunciante'] || 'Anon',
                ad.row['Descripción'] || '',
                ad.processed.longevity,
                ad.processed.trustScore,
                ad.row['Videos'] || 'N/A',
                ad.row['pfp'] || 'N/A'
            );
        });
        stmt.finalize();
    });

    res.json({ status: 'committed', count: ads.length });
});

app.post('/upload', upload.single('data'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file' });
        const form = new FormData();
        form.append('data', fs.createReadStream(req.file.path), {
            filename: req.file.originalname, contentType: req.file.mimetype
        });
        const response = await axios.post(process.env.WEBHOOK_URL, form, {
            headers: { ...form.getHeaders() }
        });
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ status: 'success', data: response.data });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        // --- LOG LOGIC PARA DEBUGEAR ERROR 500 ---
        console.error("❌ ERROR EN ENVÍO A N8N:");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error("Data:", error.response.data);
        } else {
            console.error("Message:", error.message);
        }

        res.status(500).json({
            error: 'n8n error',
            details: error.message,
            advice: 'Revisa si el flujo de n8n está activo o si el webhook-URL es correcto.'
        });
    }
});

app.listen(port, () => console.log(`Process active... Node v${process.versions.node} - Port: ${port}`));
