const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(cors());

// Uploads folder setup
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

// Multer configuration for audio upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Hamesha unique ya standard naam dein taaki conflict na ho
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage: storage });

// Current playing song track info
let currentSongFile = null;

// -------------------------------------------------------------
// 1. ADMIN PANEL (Browser par khulte hi upload form dikhega)
// -------------------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>FM Radio Admin Panel</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f4f9; text-align: center; padding: 50px; }
                .card { background: white; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0px 4px 10px rgba(0,0,0,0.1); }
                input, button { margin: 10px 0; padding: 10px; font-size: 16px; }
                button { background: #007BFF; color: white; border: none; border-radius: 5px; cursor: pointer; }
                button:hover { background: #0056b3; }
                .status { margin-top: 15px; color: green; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>📻 FM Radio Control Panel</h2>
                <p>Naya gaana upload karein (Purana gaana apne aap delete ho jayega taaki storage full na ho)</p>
                <form action="/upload" method="POST" enctype="multipart/form-data">
                    <input type="file" name="audio" accept="audio/*" required><br>
                    <button type="submit">Upload & Stream Now</button>
                </form>
                <div class="status">Current Playing: <span id="current">Loading...</span></div>
                <br>
                <h3>Friend ke liye Stream URL:</h3>
                <input type="text" value="${req.protocol}://${req.get('host')}/stream" readonly style="width: 100%; text-align: center;">
            </div>

            <script>
                fetch('/status')
                    .then(res => res.json())
                    .then(data => {
                        document.getElementById('current').innerText = data.song || 'Koi gaana nahi chal raha';
                    });
            </script>
        </body>
        </html>
    `);
});

// -------------------------------------------------------------
// 2. UPLOAD ENDPOINT (Auto-Cleanup ke sath)
// -------------------------------------------------------------
app.post('/upload', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // AUTO-CLEANUP: Agar pehle se koi gaana folder mein hai, toh use delete kar do taaki storage full na ho!
    fs.readdir(UPLOAD_DIR, (err, files) => {
        if (!err) {
            files.forEach(file => {
                // Agar file naye upload ki hui file nahi hai, toh use uda do
                if (file !== req.file.filename) {
                    const oldFilePath = path.join(UPLOAD_DIR, file);
                    fs.unlink(oldFilePath, (unlinkErr) => {
                        if (unlinkErr) console.error("Error deleting old file:", unlinkErr);
                        else console.log(`[Storage Cleared] Deleted old file: ${file}`);
                    });
                }
            });
        }
    });

    // Naye gaane ko current song set kar do
    currentSongFile = path.join(UPLOAD_DIR, req.file.filename);
    console.log(`[FM Radio] New song uploaded and active: ${req.file.originalname}`);

    // Upload hone ke baad wapas panel par bhej do
    res.redirect('/');
});

// -------------------------------------------------------------
// 3. SINGLE STREAM URL (Chunks ke through audio play hogi)
// -------------------------------------------------------------
app.get('/stream', (req, res) => {
    if (!currentSongFile || !fs.existsSync(currentSongFile)) {
        return res.status(404).send('No active song streaming right now.');
    }

    const stat = fs.statSync(currentSongFile);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(currentSongFile, { start, end });
        
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg',
        });
        file.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'audio/mpeg',
        });
        fs.createReadStream(currentSongFile).pipe(res);
    }
});

// Status check API
app.get('/status', (req, res) => {
    if (currentSongFile && fs.existsSync(currentSongFile)) {
        res.json({ song: path.basename(currentSongFile) });
    } else {
        res.json({ song: null });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`FM Radio Panel running on port ${PORT}`);
});
