const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
app.use(cors());

// Multer ko memory storage par configure kiya (Hard disk par save nahi hoga, RAM mein rahega)
const upload = multer({ storage: multer.memoryStorage() });

let activeAudioBuffer = null;
let activeAudioMime = 'audio/mpeg';

// 1. Admin Panel UI
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>FM Radio Admin Panel</title>
            <style>
                body { font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 40px; }
                .card { background: #1e293b; padding: 30px; border-radius: 12px; display: inline-block; width: 100%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
                input, button { margin: 12px 0; padding: 12px; font-size: 15px; border-radius: 6px; border: none; width: 100%; box-sizing: border-box; }
                input[type="file"] { background: #334155; color: white; }
                button { background: #22c55e; color: black; cursor: pointer; font-weight: bold; }
                button:hover { background: #16a34a; }
                .status { margin-top: 15px; color: #38bdf8; font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>📻 FM Radio Station</h2>
                <p style="font-size: 13px; color: #94a3b8;">Gaana select karo aur turant live karo</p>
                
                <form action="/upload" method="POST" enctype="multipart/form-data">
                    <input type="file" name="audio" accept="audio/*" required><br>
                    <button type="submit">Upload & Stream</button>
                </form>

                <div class="status">Status: ${activeAudioBuffer ? '🟢 Song Active in Memory' : '🔴 No Song Loaded'}</div>
                
                <br><hr style="border: 0.5px solid #334155;"><br>
                <h3 style="font-size: 14px;">Friend ka Listener URL:</h3>
                <input type="text" value="${req.protocol}://${req.get('host')}/stream" readonly style="background: #0f172a; color: #38bdf8; text-align: center; padding: 10px; border-radius: 6px; border: 1px solid #334155;">
            </div>
        </body>
        </html>
    `);
});

// 2. Direct Memory Upload Route (No Hard Disk Space Used)
app.post('/upload', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // File seedha RAM (Memory) mein store ho gayi
    activeAudioBuffer = req.file.buffer;
    activeAudioMime = req.file.mimetype || 'audio/mpeg';

    console.log(`[Memory] Loaded file '${req.file.originalname}' (${activeAudioBuffer.length} bytes)`);
    res.redirect('/');
});

// 3. Listener Stream Route
app.get('/stream', (req, res) => {
    if (!activeAudioBuffer) {
        return res.status(404).send('No active audio loaded in memory yet.');
    }

    const fileSize = activeAudioBuffer.length;
    const range = req.headers.range;

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
            'Content-Type': activeAudioMime,
        });
        res.end(chunk);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': activeAudioMime,
        });
        res.end(activeAudioBuffer);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
