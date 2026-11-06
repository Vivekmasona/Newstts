const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Active listeners ki list jo /stream par connected hain
let listeners = [];
// Latest live audio chunk ko yaad rakhne ke liye taaki naya listener aate hi use pehla chunk mil jaye
let latestChunk = null;

// -------------------------------------------------------------
// 1. BROADCASTER PANEL (Yahan se aap live audio bhejenge)
// -------------------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Instant Live Radio Broadcaster</title>
            <style>
                body { font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 30px; }
                .card { background: #1e293b; padding: 25px; border-radius: 12px; display: inline-block; width: 100%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
                input, button { margin: 10px 0; padding: 12px; font-size: 15px; border-radius: 6px; border: none; width: 100%; box-sizing: border-box; }
                input[type="file"] { background: #334155; color: white; }
                button { background: #ef4444; color: white; cursor: pointer; font-weight: bold; }
                button.active { background: #22c55e; }
                .status { margin-top: 15px; color: #38bdf8; font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>🔴 Instant Live Radio</h2>
                <p style="font-size: 13px; color: #94a3b8;">Zero Upload Wait - 1 Second Live Stream</p>
                
                <input type="file" id="audioFile" accept="audio/*"><br>
                <button id="liveBtn" onclick="toggleLive()">Start Live Broadcasting</button>
                
                <div class="status" id="statusMsg">Status: Disconnected</div>
                
                <br><hr style="border: 0.5px solid #334155;"><br>
                <h3 style="font-size: 14px;">Friend ka Permanent Listener URL:</h3>
                <input type="text" value="${req.protocol}://${req.get('host')}/stream" readonly style="background: #0f172a; color: #38bdf8; text-align: center; border: 1px solid #334155;">
            </div>

            <script>
                let ws;
                let isLive = false;
                let intervalId;

                function connectWS() {
                    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
                    ws = new WebSocket(protocol + location.host);
                    
                    ws.onopen = () => document.getElementById('statusMsg').innerText = "Status: Ready to Go Live";
                    ws.onclose = () => {
                        document.getElementById('statusMsg').innerText = "Status: Reconnecting...";
                        setTimeout(connectWS, 2000);
                    };
                }
                connectWS();

                async function toggleLive() {
                    const fileInput = document.getElementById('audioFile');
                    if (fileInput.files.length === 0) {
                        alert("Pehle koi audio file select karo!");
                        return;
                    }

                    const file = fileInput.files[0];
                    const btn = document.getElementById('liveBtn');

                    if (!isLive) {
                        isLive = true;
                        btn.innerText = "Stop Live Stream";
                        btn.classList.add('active');
                        document.getElementById('statusMsg').innerText = "Status: 🔴 LIVE STREAMING...";

                        // Audio ko Web Audio API se read karke real-time chunks bhejna
                        const arrayBuffer = await file.arrayBuffer();
                        const CHUNK_SIZE = 16 * 1024; // 16KB chhote chunks taaki 1 second mein pahunche
                        let offset = 0;

                        intervalId = setInterval(() => {
                            if (offset >= arrayBuffer.byteLength) {
                                offset = 0; // Loop wapas shuru kar dega radio ki tarah
                            }

                            const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(chunk);
                            }
                            offset += CHUNK_SIZE;
                        }, 100); // Har 100ms mein live chunk stream hoga

                    } else {
                        isLive = false;
                        clearInterval(intervalId);
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
// 2. WEBSOCKET REAL-TIME RELAY
// -------------------------------------------------------------
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        latestChunk = message;
        // Jaise hi broadcaster se chunk aaye, sabhi active listeners ko turant bhej do
        listeners.forEach(clientRes => {
            clientRes.write(message);
        });
    });
});

// -------------------------------------------------------------
// 3. INSTANT LISTENER STREAM ROUTE
// -------------------------------------------------------------
app.get('/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*'
    });

    listeners.push(res);
    console.log(`[Listener Connected] Total listeners: ${listeners.length}`);

    req.on('close', () => {
        listeners = listeners.filter(client => client !== res);
        console.log(`[Listener Disconnected] Total listeners: ${listeners.length}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Instant Live Radio running on port ${PORT}`);
});
