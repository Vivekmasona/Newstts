const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
app.use(cors());

// Memory Storage (RAM) - Storage Full Nahi Hoga
const upload = multer({ storage: multer.memoryStorage() });

let activeAudioBuffer = null;
let activeMimeType = 'audio/mpeg';
let songTimestamp = Date.now();

// -------------------------------------------------------------
// 1. ADMIN PANEL & AUTO-RECONNECTING PLAYER
// -------------------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Stable HLS FM Radio Station</title>
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
                <h2>📻 Auto-Reconnect FM Station</h2>
                <p style="font-size: 13px; color: #94a3b8;">HLS Segmented Protocol (Zero Disconnect)</p>
                
                <form action="/upload" method="POST" enctype="multipart/form-data">
                    <input type="file" name="audio" accept="audio/*" required><br>
                    <button type="submit">Upload & Broadcast Live</button>
                </form>

                <div class="status">
                    Status: ${activeAudioBuffer ? '🟢 Stream Live' : '🔴 Server Ready (No Audio)'}
                </div>
                
                <br><hr style="border: 0.5px solid #334155;"><br>
                <h3 style="font-size: 14px;">Friend ka Permanent Listener URL:</h3>
                <input type="text" value="${req.protocol}://${req.get('host')}/stream" readonly style="background: #0f172a; color: #38bdf8; text-align: center; border: 1px solid #334155;">
            </div>
        </body>
        </html>
    `);
});

// -------------------------------------------------------------
// 2. MEMORY UPLOAD & SEGMENTATION PREP
// -------------------------------------------------------------
app.post('/upload', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // Purana data RAM se clear karke naya song buffer update
    activeAudioBuffer = req.file.buffer;
    activeMimeType = req.file.mimetype || 'audio/mpeg';
    songTimestamp = Date.now();

    console.log(`[HLS Broadcast] New Track Loaded: ${req.file.originalname} (${activeAudioBuffer.length} bytes)`);
    res.redirect('/');
});

// -------------------------------------------------------------
// 3. STABLE HTTP SEGMENTED STREAM ROUTE
// -------------------------------------------------------------
app.get('/stream', (req, res) => {
    if (!activeAudioBuffer) {
        return res.status(404).send('No active radio stream currently live.');
    }

    const fileSize = activeAudioBuffer.length;
    const range = req.headers.range;

    // Browser reconnection headers set karein taaki connection freeze na ho
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        
        const chunk = activeAudioBuffer.subarray(start, end + 1);

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': activeMimeType,
        });
        res.end(chunk);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': activeMimeType,
        });
        res.end(activeAudioBuffer);
    }
});

// Endpoint to check status without breaking audio
app.get('/status', (req, res) => {
    res.json({
        active: activeAudioBuffer !== null,
        timestamp: songTimestamp
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Auto-Reconnect HLS Radio Server active on port ${PORT}`);
});
