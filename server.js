const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    if (filePath.startsWith('./js/')) {
        filePath = '.' + req.url;
    } else if (filePath.startsWith('./css/')) {
        filePath = '.' + req.url;
    } else if (filePath.startsWith('./lib/')) {
        filePath = '.' + req.url;
    }

    const extname = path.extname(filePath);
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            console.error(`Error serving ${filePath}:`, error);
            if(error.code === 'ENOENT') {
                res.writeHead(404);
                res.end(`File not found: ${filePath}`);
            } else {
                res.writeHead(500);
                res.end(`Server error: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-cache'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}/`);
    console.log('Press Ctrl+C to stop the server');
}); 