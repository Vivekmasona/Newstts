const express = require('express');
const cors = require('cors');
const { Readable } = require('stream');

const app = express();
app.use(express.json({ limit: '50mb' })); // Badi audio ke liye limit badha di
app.use(cors());

// RAM (Memory) mein audio buffer store karne ke liye
let audioBuffer = null;
let currentSongName = "No song playing";

// -------------------------------------------------------------
// 1. ADMIN PANEL (Yahan se aap instant audio push karenge)
// -------------------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Instant Memory Radio Panel</title>
            <style>
                body { font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 50px; }
                .card { background: #1e293b; padding: 30px; border-radius: 12px; display: inline-block; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
                input, button { margin: 12px 0; padding: 12px; font-size: 16px; border-radius: 6px; border: none; }
                input[type="file"] { background: #334155; color: white; width: 100%; }
                button { background: #3b82f6; color: white; cursor: pointer; font-weight: bold; width: 100%; }
                button:hover { background: #2563eb; }
                .status { margin-top: 15px; color: #38bdf8; font-weight: bold; }
                #progress { width: 100%; background: #334155; border-radius: 6px; overflow: hidden; display: none; margin-top: 10px; }
                #bar { width: 0%; height: 20px; background: #22c55e; text-align: center; line-height: 20px; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>⚡ Instant Memory Radio</h2>
                <p>File select karo aur turant memory mein stream karo (Zero Upload Wait)</p>
                
                <input type="file" id="audioFile" accept="audio/*"><br>
                <button onclick="uploadToMemory()">Stream Instantly</button>
                
                <div id="progress"><div id="bar">0%</div></div>
                <div class="status" id="statusMsg">Status: Ready</div>
                
                <br><hr style="border: 0.5px solid #334155;"><br>
                <h3>Friend ka Listener URL:</h3>
                <input type="text" value="${req.protocol}://${req.get('host')}/stream" readonly style="width: 100%; text-align: center; background: #0f172a; color: #38bdf8; padding: 10px; border-radius: 6px;">
            </div>

            <script>
                async function uploadToMemory() {
                    const fileInput = document.getElementById('audioFile');
                    if (fileInput.files.length === 0) {
                        alert("Pehle audio file select karo!");
                        return;
                    }

                    const file = fileInput.files[0];
                    document.getElementById('progress').style.display = 'block';
                    document.getElementById('statusMsg').innerText = "Reading file into memory...";

                    const reader = new FileReader();
                    reader.onload = async function(e) {
                        const base64Data = e.target.result;
                        
                        document.getElementById('statusMsg').innerText = "Pushing to server RAM...";
                        document.getElementById('bar').style.width = "50%";
                        document.getElementById('bar').innerText = "Processing...";

                        try {
                            const response = await fetch('/push-audio', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    filename: file.name,
                                    audioData: base64Data 
                                })
                            });

                            const result = await response.json();
                            if(result.success) {
                                document.getElementById('bar').style.width = "100%";
                                document.getElementById('bar').innerText = "Done!";
                                document.getElementById('statusMsg').innerText = "Now Streaming: " + file.name;
                            } else {
                                alert("Error: " + result.message);
                            }
                        } catch (err) {
                            alert("Upload failed: " + err.message);
                        }
                    };
                    
                    reader.readAsDataURL(file);
                }
            </script>
        </body>
        </html>
    `);
});

// -------------------------------------------------------------
// 2. RECEIVE CHUNKS INTO RAM (No Hard Disk Saving)
// -------------------------------------------------------------
app.post('/push-audio', (req, res) => {
    try {
        const { filename, audioData } = req.body;
        if (!audioData) return res.status(400).json({ success: false, message: 'No data provided' });

        // Base64 data ko Buffer mein convert karke RAM mein rakh liya
        const base64String = audioData.split(';base64,').pop();
        audioBuffer = Buffer.from(base64String, 'base64');
        currentSongName = filename;

        console.log(`[Memory Stream] Loaded '${filename}' into RAM (${audioBuffer.length} bytes)`);
        res.json({ success: true, message: 'Audio loaded into server memory successfully!' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// -------------------------------------------------------------
// 3. STABLE HTTP STREAM FOR LISTENERS
// -------------------------------------------------------------
app.get('/stream', (req, res) => {
    if (!audioBuffer) {
        return res.status(404).send('No active audio loaded in memory yet.');
    }

    const fileSize = audioBuffer.length;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        
        // RAM Buffer ka specific tukda slice karke bhejna
        const chunk = audioBuffer.subarray(start, end + 1);

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg',
        });
        res.end(chunk);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'audio/mpeg',
        });
        res.end(audioBuffer);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Memory Stream Radio running on port ${PORT}`);
});
