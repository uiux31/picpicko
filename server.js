const express = require('express');
const crypto = require('crypto');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;
const TTL_MS = 60 * 1000; // 60 seconds auto-delete

app.use(express.json({ limit: '20mb' }));
app.use(express.static('public'));

const imageStore = new Map();

// Helper to find your REAL network IP, ignoring VirtualBox/VMware
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        // Skip virtual machine adapters
        const lowerName = name.toLowerCase();
        if (lowerName.includes('virtual') || lowerName.includes('vmware') || lowerName.includes('vethernet')) {
            continue;
        }

        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                // Hard-skip the common VirtualBox IP
                if (iface.address.startsWith('192.168.56.')) continue;
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// 1. Upload API
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

    const networkIp = getLocalIP();
    // Send the absolute network URL back to the frontend for the QR code
    res.json({ downloadUrl: `http://${networkIp}:${PORT}/d/${id}` });
});

// 2. Serve Download Page to the phone
app.get('/d/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'download.html'));
});

// 3. API to fetch the image data
app.get('/api/image/:id', (req, res) => {
    const image = imageStore.get(req.params.id);
    if (!image) return res.status(404).json({ error: 'Expired' });
    res.json({ image });
});

app.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log(`\n🚀 Photo Booth is running!`);
    console.log(`👉 Open this on your laptop: http://localhost:${PORT}`);
    console.log(`📱 (QR codes will point to http://${ip}:${PORT} for your phone)\n`);
});