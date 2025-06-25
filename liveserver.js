const express = require('express');
const path = require("path");
const fs = require('fs');
const ws = require('ws');

const app = express();
const wss = new ws.Server({ port: 4841 });
const folderName = process.cwd();

function broadcast(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === ws.OPEN) {
            console.log('[+] Message sent to client:', message);
            client.send(message);
        }
    });
}
function injectWebSocketScript(req, res, next) {
    // Récupérer le chemin du fichier demandé
    if (req.url === '/') {
        req.url += '/index.html';
    }
    const filePath = path.join(folderName, req.url);

    // Vérifier si le fichier demandé est un fichier HTML
    if (filePath.endsWith('.html')) {
        // Lire le contenu du fichier HTML
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error('[!] Erreur lors de la lecture du fichier HTML :', err);
                next();
            } else {
                // Ajouter le script WebSocket à la fin de la balise body
                const injectedScript = `
                <script>
                    const socket = new WebSocket('ws://localhost:4841');
                    socket.addEventListener('message', (event) => {
                        let content = event.data.split(' ');
                        if (content[0] == 'file-modified') {
                            if (content[1] == '${filePath}') {
                                location.reload();
                            }
                        }
                    });
                </script>`;

                const modifiedContent = data.replace('</body>', `${injectedScript}\n</body>`);

                // Envoyer le contenu modifié au client
                res.set('Content-Type', 'text/html');
                res.send(modifiedContent);
            }
        });
    } else {
        // Continuer le pipeline middleware pour les autres types de fichiers
        next();
    }
}
function watchFilesRecursively(folderPath) {
    // Surveiller les changements de fichiers dans le dossier actuel
    fs.watch(folderPath, { recursive: true }, (eventType, filename) => {
        // Ignorer les événements "change" et "rename" sur les répertoires
        if (eventType === 'change' || eventType === 'rename') {
            const filePath = path.join(folderPath, filename);
            // Vérifier si le chemin est un dossier
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error('Erreur lors de la récupération des informations sur le fichier :', err);
                    return;
                }
                // Si c'est un dossier, appeler récursivement watchFilesRecursively() pour surveiller ses fichiers
                if (stats.isDirectory()) {
                    watchFilesRecursively(filePath);
                } else {
                    // Sinon, diffuser l'événement de changement de fichier
                    console.log('[+] File changed:', filePath);
                    broadcast(`file-modified ${filePath}`);
                }
            });
        }
    });
}


// on défini la page 404
app.use(injectWebSocketScript);
app.use(express.static(folderName));

app.use((req, res, next) => {
    res.status(404).send(`
    <!Doctype html>
    <html>
        <head>
            <title>File not found</title>
        </head>
        <body style="background-color: #121212;">
            <h1 style="color: white;">File not found</h1>
            <p style="color: white;">The file <b>"${req.url.replace('/', '')}"</b> could not be found. It may have been moved or deleted.</p>
        </body>
    </html>
    `);
});

watchFilesRecursively(folderName);


wss.on('connection', (ws) => {
    console.log('[+] New client connected');
});

app.listen(3000, () => {
    console.log('[+] Server started on port 3000');
});