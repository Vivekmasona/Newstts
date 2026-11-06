const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(cors());

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

// Hamesha ek hi fixed naam se file save hogi taaki storage na bhare
const activeSongPath = path.join(UPLOAD_DIR, 'current-song.mp3');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, 'current-song.mp3'); // Purani file automatically overwrite ho jayegi!
    }
});
const upload = multer({ storage: storage });

// -------------------------------------------------------------
// 1. ADMIN PANEL (Yahan se aap gaana upload karenge)
// -------------------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Stable FM Radio Panel</title>
            <style>
                body { font-family: Arial, sans-serif; background: #121212; color: #fff; text-align: center; padding: 50px; }
                .card { background: #1e1e1e; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0px 4px 15px rgba(0,0,0,0.5); }
                input, button { margin: 10px 0; padding: 12px; font-size: 16px; }
                button { background: #6200ee; color: white; border: none; border-radius: 5px; cursor: pointer; }
                button:hover { background: #3700b3; }
                .status { margin-top: 15px; color: #03dac6; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>📻 Stable FM Radio Panel</h2>
                <p>Naya gaana upload karein (Storage hamesha khali rahegi, disconnect nahi hoga)</p>
                <form action="/upload" method="POST" enctype="multipart/form-data">
                    <input type="file" name="audio" accept="audio/*" required><br>
                    <button type="submit">Upload & Update Song</button>
                </form>
                <div class="status">Status: Server Online (Ready)</div>
                <br>
                <h3>Friend ka Listener URL (Yeh URL copy karke friend ko dein):</h3>
                <input type="text" value="${req.protocol}://${req.get('host')}/stream" readonly style="width: 100%; text-align: center; background: #2c2c2c; color: #fff; border: 1px solid #444; padding: 10px;">
            </div>
        </body>
        </html>
    `);
});

// -------------------------------------------------------------
// 2. UPLOAD ROUTE (Purana gaana delete/overwrite ho jayega)
// -------------------------------------------------------------
app.post('/upload', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    console.log('[FM Radio] Song updated successfully. Storage is clean.');
    res.redirect('/');
});

// -------------------------------------------------------------
// 3. STABLE STREAM ROUTE (Bina disconnect hue chalne wala stream)
// -------------------------------------------------------------
app.get('/stream', (req, res) => {
    if (!fs.existsSync(activeSongPath)) {
        return res.status(404).send('No song uploaded yet.');
    }

    const stat = fs.statSync(activeSongPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(activeSongPath, { start, end });
        
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
        fs.createReadStream(activeSongPath).pipe(res);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Stable FM Radio Server running on port ${PORT}`);
});
