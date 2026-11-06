const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Active listeners ki list jo /stream par connected hain
let listeners = [];

// -------------------------------------------------------------
// 1. BROADCASTER PANEL (Yahan se aap audio chunks live bhejenge)
// -------------------------------------------------------------
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Live Chunk Broadcaster Panel</title>
            <style>
                body { font-family: Arial, sans-serif; background: #111; color: #fff; text-align: center; padding: 50px; }
                .card { background: #222; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0px 4px 15px rgba(0,255,0,0.2); }
                input, button { margin: 10px 0; padding: 12px; font-size: 16px; }
                button { background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; }
                button:hover { background: #218838; }
                #status { font-weight: bold; margin-top: 15px; color: #ffc107; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>🎙️ Live Chunk Radio Station</h2>
                <p>Audio select karein aur live chunk stream shuru karein (Zero Server Storage)</p>
                <input type="file" id="audioFile" accept="audio/*"><br>
                <button id="startBtn" onclick="startStreaming()">Start Live Stream</button>
                <div id="status">Status: Disconnected</div>
                <br>
                <h3>Friend ka Listener URL:</h3>
                <input type="text" value="${req.protocol}://${req.get('host')}/stream" readonly style="width: 100%; text-align: center; background: #333; color: #fff; border: 1px solid #444;">
            </div>

            <script>
                let ws;
                function connectWebSocket() {
                    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
                    ws = new WebSocket(protocol + location.host);
                    
                    ws.onopen = () => document.getElementById('status').innerText = "Status: Connected to Server (Ready)";
                    ws.onclose = () => {
                        document.getElementById('status').innerText = "Status: Disconnected. Reconnecting...";
                        setTimeout(connectWebSocket, 2000);
                    };
                }
                connectWebSocket();

                function startStreaming() {
                    const fileInput = document.getElementById('audioFile');
                    if (fileInput.files.length === 0) {
                        alert("Pehle koi audio file select karein!");
                        return;
                    }

                    const file = fileInput.files[0];
                    const CHUNK_SIZE = 64 * 1024; // 64 KB ka chunk
                    let offset = 0;

                    document.getElementById('status').innerText = "Status: Streaming Live Chunks...";
                    
                    const readerStream = setInterval(() => {
                        if (offset >= file.size) {
                            clearInterval(readerStream);
                            document.getElementById('status').innerText = "Status: Stream Finished!";
                            return;
                        }

                        const slice = file.slice(offset, offset + CHUNK_SIZE);
                        const fileReader = new FileReader();
                        
                        fileReader.onload = function(event) {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(event.target.result); // ArrayBuffer chunk bhej rahe hain
                            }
                        };
                        fileReader.readAsArrayBuffer(slice);
                        offset += CHUNK_SIZE;

                    }, 200); // Har 200ms mein ek chunk bhejega (Real-time speed maintain karne ke liye)
                }
            </script>
        </body>
        </html>
    `);
});

// -------------------------------------------------------------
// 2. WEBSOCKET SERVER (Broadcaster se chunks receive karega)
// -------------------------------------------------------------
wss.on('connection', (ws) => {
    console.log('[Broadcaster] Connected to live stream feed.');

    ws.on('message', (message) => {
        // Jaise hi broadcaster se koi chunk aaye, sabhi active listeners ko bhej do
        listeners.forEach(clientRes => {
            clientRes.write(message);
        });
    });

    ws.on('close', () => {
        console.log('[Broadcaster] Disconnected.');
    });
});

// -------------------------------------------------------------
// 3. LISTENER STREAM ROUTE (Friend yahan se chunks receive karega)
// -------------------------------------------------------------
app.get('/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*'
    });

    // Listener ko active list mein add kar liya
    listeners.push(res);
    console.log(`[Listener Connected] Total listeners: ${listeners.length}`);

    req.on('close', () => {
        // Listener disconnect hone par list se hata do
        listeners = listeners.filter(client => client !== res);
        console.log(`[Listener Disconnected] Total listeners: ${listeners.length}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Live Chunk Radio Server running on port ${PORT}`);
});
