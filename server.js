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

// Helper de Mantenimiento: Logger del Sistema
const logFile = path.join(__dirname, 'system.log');
const systemLog = (type, message, details = '') => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type}] ${message} ${details ? '| Detalles: ' + JSON.stringify(details) : ''}\n`;
    fs.appendFileSync(logFile, logEntry, "utf8");
    console.log(logEntry.trim());
};

// Inicialización de base de datos SQL "temporal"
const db = new sqlite3.Database(path.join(__dirname, 'data.db'));
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS ads (id INTEGER PRIMARY KEY AUTOINCREMENT, ad_id TEXT UNIQUE, advertiser TEXT, description TEXT, longevity INTEGER, trust_score REAL, media_url TEXT, pfp_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 15 * 1024 * 1024 } // Límite de 15MB para prevenir DOS
});

// --- CAPA DE SEGURIDAD (PREVENCIÓN DE DATA LEAKS) ---
app.use((req, res, next) => {
    const sensitiveFiles = ['.env', 'server.js', 'data.db', 'system.log', 'package.json'];
    const requestedFile = req.path.toLowerCase();
    
    // Si la ruta contiene alguno de los archivos prohibidos, lo bloqueamos inmediatamente.
    const isSensitive = sensitiveFiles.some(file => requestedFile.includes(file));
    
    if (isSensitive) {
        systemLog('SECURITY_ALERT', 'Tentativa de acceso a archivo del sistema', { path: req.path, ip: req.ip });
        return res.status(403).json({ error: 'Access Denied: Protected System File' });
    }
    next();
});


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

    const stmt = db.prepare("INSERT OR IGNORE INTO ads (ad_id, advertiser, description, longevity, trust_score, media_url, pfp_url) VALUES (?, ?, ?, ?, ?, ?, ?)");

    db.serialize(() => {
        ads.forEach(ad => {
            stmt.run(
                ad.row['ID'] || null, // ID original de Meta Ads
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
        const errorDetails = error.response ? { status: error.response.status, data: error.response.data } : error.message;
        systemLog('ERROR_N8N', 'Fallo al enviar CSV al webhook', errorDetails);

        res.status(500).json({
            error: 'n8n error',
            details: error.message,
            advice: 'Revisa si el flujo de n8n está activo o si el webhook-URL es correcto.'
        });
    }
});

const { exec } = require('child_process');

app.post('/system/media/archive', async (req, res) => {
    const { mediaUrls } = req.body;
    if (!mediaUrls || !Array.isArray(mediaUrls)) return res.status(400).send('No URLs provided');

    const timestamp = Date.now();
    const tempDir = path.join(__dirname, 'uploads', `archive_${timestamp}`);
    const zipPath = path.join(__dirname, 'uploads', `anuncios_media_${timestamp}.zip`);

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    try {
        const downloadPromises = mediaUrls.map(async (url, index) => {
            if (!url || url === 'N/A') return;
            try {
                const response = await axios({ url, method: 'GET', responseType: 'stream', timeout: 30000 });
                const extension = url.includes('.mp4') ? 'mp4' : 'jpg';
                const filePath = path.join(tempDir, `anuncio_${index + 1}.${extension}`);
                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);
                return new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
            } catch (err) {
                console.error(`Error downloading ${url}:`, err.message);
            }
        });

        await Promise.all(downloadPromises);

        // Compresión usando PowerShell (Windows)
        const psCommand = `powershell "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipPath}' -Force"`;
        exec(psCommand, (error) => {
            if (error) {
                systemLog('ERROR_ZIP', 'Fallo al comprimir medios', error.message);
                return res.status(500).send('Error creating zip');
            }
            res.download(zipPath, `media_ads_${timestamp}.zip`, (err) => {
                if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
            });
        });
    } catch (error) {
        systemLog('ERROR_ARCHIVE', 'Fallo general en proceso de archivado', error.message);
        res.status(500).send('Archive process failed');
    }
});

app.listen(port, () => console.log(`Process active... Node v${process.versions.node} - Port: ${port}`));
