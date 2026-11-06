const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let listeners = [];
let liveAudioChunks = []; // Server RAM buffer for live streaming

// -------------------------------------------------------------
// 1. BROADCASTER PANEL (Instant Live Streaming, Zero Upload Wait)
// -------------------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Instant Live FM Broadcaster</title>
            <style>
                body { font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 30px; }
                .card { background: #1e293b; padding: 25px; border-radius: 12px; display: inline-block; width: 100%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
                input, button { margin: 10px 0; padding: 12px; font-size: 15px; border-radius: 6px; border: none; width: 100%; box-sizing: border-box; }
                input[type="file"] { background: #334155; color: white; }
                button { background: #ef4444; color: white; cursor: pointer; font-weight: bold; }
                button.active { background: #22c55e; color: black; }
                .status { margin-top: 15px; color: #38bdf8; font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>🔴 Instant Live FM Panel</h2>
                <p style="font-size: 13px; color: #94a3b8;">No Upload Wait - 1 Sec Live Streaming</p>
                
                <input type="file" id="audioFile" accept="audio/*"><br>
                <button id="liveBtn" onclick="toggleLiveStream()">Start Live Broadcasting</button>
                
                <div class="status" id="statusMsg">Status: Connecting...</div>
                
                <br><hr style="border: 0.5px solid #334155;"><br>
                <h3 style="font-size: 14px;">Friend ka Standard Listener URL:</h3>
                <input type="text" value="${req.protocol}://${req.get('host')}/stream" readonly style="background: #0f172a; color: #38bdf8; text-align: center; border: 1px solid #334155;">
            </div>

            <script>
                let ws;
                let isLive = false;
                let audioContext;
                let sourceNode;

                function connectWS() {
                    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
                    ws = new WebSocket(protocol + location.host);
                    
                    ws.onopen = () => document.getElementById('statusMsg').innerText = "Status: Ready to Go Live ⚡";
                    ws.onclose = () => {
                        document.getElementById('statusMsg').innerText = "Status: Reconnecting WebSocket...";
                        setTimeout(connectWS, 2000);
                    };
                }
                connectWS();

                async function toggleLiveStream() {
                    const fileInput = document.getElementById('audioFile');
                    if (fileInput.files.length === 0) {
                        alert("Pehle koi audio file select karo!");
                        return;
                    }

                    const btn = document.getElementById('liveBtn');

                    if (!isLive) {
                        isLive = true;
                        btn.innerText = "Stop Live Broadcast";
                        btn.classList.add('active');
                        document.getElementById('statusMsg').innerText = "Status: 🔴 LIVE STREAMING...";

                        const file = fileInput.files[0];
                        const arrayBuffer = await file.arrayBuffer();

                        audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                        sourceNode = audioContext.createBufferSource();
                        sourceNode.buffer = audioBuffer;

                        const dest = audioContext.createMediaStreamDestination();
                        sourceNode.connect(dest);
                        sourceNode.connect(audioContext.destination); // Apne sunne ke liye
                        sourceNode.start(0);

                        const mediaRecorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
                        
                        mediaRecorder.ondataavailable = (event) => {
                            if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                                ws.send(event.data);
                            }
                        };

                        mediaRecorder.start(500); // Har 500ms ke live chunks server ko bhejega
                        sourceNode.onended = () => {
                            if (isLive) toggleLiveStream(); // Loop song
                        };

                    } else {
                        isLive = false;
                        if (audioContext) audioContext.close();
                        btn.innerText = "Start Live Broadcasting";
                        btn.classList.remove('active');
                        document.getElementById('statusMsg').innerText = "Status: Stopped";
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// -------------------------------------------------------------
// 2. WEBSOCKET CHUNK RELAY
// -------------------------------------------------------------
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        liveAudioChunks.push(message);
        if (liveAudioChunks.length > 50) liveAudioChunks.shift(); // Keep last 50 chunks in memory

        // Sabhi active listeners ko live chunk turant bhej do
        listeners.forEach(clientRes => {
            clientRes.write(message);
        });
    });
});

// -------------------------------------------------------------
// 3. STANDARD LISTENER STREAM (No WebRTC / No P2P needed for friends)
// -------------------------------------------------------------
app.get('/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'audio/webm',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*'
    });

    // Pehle ke cached live chunks bhejo taaki turant play ho jaye
    liveAudioChunks.forEach(chunk => res.write(chunk));

    listeners.push(res);

    req.on('close', () => {
        listeners = listeners.filter(client => client !== res);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Instant Live FM Server running on port ${PORT}`);
});
