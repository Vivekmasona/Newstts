const express = require('express');
const cors = require('cors');
const http = require('http');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(cors());

// Default streaming URL (Aap koi bhi public mp3 link yahan set kar sakte hain)
let currentAudioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

// -------------------------------------------------------------
// 1. ADMIN PANEL (Yahan bas naya audio link daalna hai)
// -------------------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>24/7 Cloud Radio Station</title>
            <style>
                body { font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 30px; }
                .card { background: #1e293b; padding: 25px; border-radius: 12px; display: inline-block; width: 100%; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
                input, button { margin: 10px 0; padding: 12px; font-size: 15px; border-radius: 6px; border: none; width: 100%; box-sizing: border-box; }
                input[type="text"] { background: #334155; color: white; border: 1px solid #475569; }
                button { background: #3b82f6; color: white; cursor: pointer; font-weight: bold; }
                button:hover { background: #2563eb; }
                .status { margin-top: 15px; color: #22c55e; font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>🌐 24/7 Cloud FM Radio</h2>
                <p style="font-size: 13px; color: #94a3b8;">Bina upload kiye direct URL se 24/7 chalao</p>
                
                <form action="/set-url" method="POST">
                    <input type="text" name="audioUrl" placeholder="Audio ka direct MP3 URL yahan dalein..." required><br>
                    <button type="submit">Update 24/7 Stream</button>
                </form>

                <div class="status">Status: 🟢 24/7 Server Running Active</div>
                
                <br><hr style="border: 0.5px solid #334155;"><br>
                <h3 style="font-size: 14px;">Friend ka Permanent Listener URL:</h3>
                <input type="text" value="${req.protocol}://${req.get('host')}/stream" readonly style="background: #0f172a; color: #38bdf8; text-align: center;">
            </div>
        </body>
        </html>
    `);
});

// -------------------------------------------------------------
// 2. UPDATE STREAM URL ROUTE
// -------------------------------------------------------------
app.post('/set-url', (req, res) => {
    const { audioUrl } = req.body;
    if (audioUrl) {
        currentAudioUrl = audioUrl;
        console.log(`[Cloud Radio] Stream URL updated to: ${audioUrl}`);
    }
    res.redirect('/');
});

// -------------------------------------------------------------
// 3. 24/7 STABLE PROXY STREAM FOR LISTENERS
// -------------------------------------------------------------
app.get('/stream', async (req, res) => {
    try {
        // Server khud cloud se audio stream fetch karke listener ko relay karega
        const response = await fetch(currentAudioUrl);
        
        if (!response.ok) {
            return res.status(404).send('Audio source not reachable.');
        }

        res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');

        // External stream ko pipe kar dena taಕಿ 24/7 bina ruke chalta rahe
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
    console.log(`24/7 Cloud Radio running on port ${PORT}`);
});
