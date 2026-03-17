import express from 'express';
import { Server } from '@tus/server';
import { FileStore } from '@tus/file-store';
import http from 'http';

const app = express();
const tusServer = new Server({
    path: '/admin/tiffuploads',
    datastore: new FileStore({ directory: './temp' }),
});

app.all('/admin/tiffuploads', (req, res) => {
    if (req.headers['x-tus-content-type']) {
        req.headers['content-type'] = req.headers['x-tus-content-type'];
    }
    tusServer.handle(req, res);
});
app.all('/admin/tiffuploads/*', (req, res) => {
    if (req.headers['x-tus-content-type']) {
        req.headers['content-type'] = req.headers['x-tus-content-type'];
    }
    tusServer.handle(req, res);
});

const server = http.createServer(app);
server.listen(4103, async () => {
    console.log('Server started on 4103');

    // We'll simulate a POST with overridePatchMethod and masqueraded Content-Type
    const req = http.request({
        hostname: '127.0.0.1',
        port: 4103,
        path: '/admin/tiffuploads/fake_id',
        method: 'POST',
        headers: {
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': '0',
            'X-HTTP-Method-Override': 'PATCH',
            'Content-Type': 'application/octet-stream', // bypassing WAF
            'X-Tus-Content-Type': 'application/offset+octet-stream' // telling our proxy
        }
    }, (res) => {
        console.log('Status: ' + res.statusCode); // Expect 204 or 404 (because fake_id doesn't exist, but NOT 415 unsupported media type)
        process.exit(0);
    });
    req.on('error', console.error);
    req.end();
});
