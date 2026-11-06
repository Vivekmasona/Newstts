const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fetch = require('node-fetch');
const FormData = require('form-data');

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

// Default stream URL
let activeAudioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
let isProcessing = false;

// -------------------------------------------------------------
// 1. ADMIN PANEL (Simple File Selection)
// -------------------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>24/7 Auto-Cloud Radio Station</title>
            <style>
                body { font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 30px; }
                .card { background: #1e293b; padding: 25px; border-radius: 12px; display: inline-block; width: 100%; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
                input, button { margin: 10px 0; padding: 12px; font-size: 15px; border-radius: 6px; border: none; width: 100%; box-sizing: border-box; }
                input[type="file"] { background: #334155; color: white; }
                button { background: #22c55e; color: black; cursor: pointer; font-weight: bold; }
                button:hover { background: #16a34a; }
                .status { margin-top: 15px; color: #38bdf8; font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>📻 24/7 Auto-Cloud FM</h2>
                <p style="font-size: 13px; color: #94a3b8;">Phone se file chuno aur 24/7 broadcast karo</p>
                
                <form action="/upload-local" method="POST" enctype="multipart/form-data">
                    <input type="file" name="audio" accept="audio/*" required><br>
                    <button type="submit">Convert to 24/7 Cloud Stream</button>
                </form>

                <div class="status">
                    Status: ${isProcessing ? '⚡ Creating Cloud Bridge...' : '🟢 Radio Live 24/7'}
                </div>
                
                <br><hr style="border: 0.5px solid #334155;"><br>
                <h3 style="font-size: 14px;">Friend ka Permanent Stream URL:</h3>
                <input type="text" value="${req.protocol}://${req.get('host')}/stream" readonly style="background: #0f172a; color: #38bdf8; text-align: center; border: 1px solid #334155;">
            </div>
        </body>
        </html>
    `);
});

// -------------------------------------------------------------
// 2. FILE SELECTION TO CLOUD BRIDGE ROUTE
// -------------------------------------------------------------
app.post('/upload-local', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file selected.');
    }

    try {
        isProcessing = true;
        console.log(`[Bridge Engine] Uploading ${req.file.originalname} to temporary cloud CDN...`);

        // Free Fast CDN (catbox.moe / tmpfiles) par push karna direct MP3 URL ke liye
        const form = new FormData();
        form.append('fileToUpload', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype || 'audio/mpeg'
        });
        form.append('reqtype', 'fileupload');

        const cdnRes = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: form
        });

        const cloudUrl = await cdnRes.text();

        if (cloudUrl && cloudUrl.startsWith('http')) {
            activeAudioUrl = cloudUrl.trim();
            console.log(`[Bridge Engine Success] Direct Stream Link: ${activeAudioUrl}`);
        } else {
            console.error('[Bridge Error] Cloud response failed:', cloudUrl);
        }

    } catch (err) {
        console.error('[Bridge Error]', err.message);
    } finally {
        isProcessing = false;
        res.redirect('/');
    }
});

// -------------------------------------------------------------
// 3. 24/7 STABLE PROXY STREAM FOR LISTENERS
// -------------------------------------------------------------
app.get('/stream', async (req, res) => {
    try {
        const response = await fetch(activeAudioUrl);
        
        if (!response.ok) {
            return res.status(404).send('Audio source not reachable.');
        }

        res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');

        response.body.pipe(res);

        response.body.on('error', (err) => {
            console.error('Stream relay error:', err);
            res.end();
        });

    } catch (e) {
        res.status(500).send('Error streaming audio: ' + e.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`24/7 Auto-Cloud Radio Server running on port ${PORT}`);
});
