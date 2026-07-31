const express = require('express');
const crypto = require('crypto');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const TTL_MS = 60 * 1000; // 60 seconds auto-delete

app.use(express.json({ limit: '20mb' }));
app.use(express.static('public'));

const imageStore = new Map();

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('virtual') || lowerName.includes('vmware') || lowerName.includes('vethernet')) continue;
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (iface.address.startsWith('192.168.56.')) continue;
                return iface.address;
            }
        }
    }
    return 'localhost';
}

app.post('/api/upload', (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const id = crypto.randomBytes(3).toString('hex');
    imageStore.set(id, image);
    console.log(`📸 Image saved: ${id}. Will delete in 60s.`);

    setTimeout(() => {
        imageStore.delete(id);
        console.log(`🗑️ Image expired & deleted: ${id}`);
    }, TTL_MS);

    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    
    let downloadUrl;
    if (host.includes('onrender.com') || host.includes('http')) {
        downloadUrl = `${protocol}://${host}/d/${id}`;
    } else {
        const localIp = getLocalIP();
        downloadUrl = `http://${localIp}:${PORT}/d/${id}`;
    }
    
    res.json({ downloadUrl });
});

app.get('/d/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'download.html'));
});

app.get('/api/image/:id', (req, res) => {
    const image = imageStore.get(req.params.id);
    if (!image) return res.status(404).json({ error: 'Expired' });
    res.json({ image });
});

app.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log(`\n🚀 Photo Booth is running!`);
    console.log(`👉 Open on laptop: http://localhost:${PORT}`);
    console.log(`📱 Local network link: http://${ip}:${PORT}\n`);
});