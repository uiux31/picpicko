const video = document.getElementById('webcam');
let currentFilter = 'none';
let useFrontCamera = true;
let currentStream = null;

const stampLogo = new Image();
stampLogo.src = 'logo.jpg';

const quotes = [
    "\"A real friend is one who walks in when the rest of the world walks out.\"",
    "\"Friendship is born at that moment when one person says to another, 'What! You too?'\"",
    "\"There is nothing on this earth more to be prized than true friendship.\"",
    "\"A single rose can be my garden... a single friend, my world.\""
];
document.getElementById('quote-box').innerText = quotes[Math.floor(Math.random() * quotes.length)];

async function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    const constraints = {
        video: { 
            facingMode: useFrontCamera ? 'user' : 'environment', 
            width: { ideal: 1280 }, 
            height: { ideal: 720 } 
        }
    };
    try {
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;
        
        // Fix: Make the front camera act like a natural mirror!
        if (useFrontCamera) {
            video.style.transform = 'scaleX(-1)';
        } else {
            video.style.transform = 'scaleX(1)';
        }
    } catch (err) {
        alert("Camera access denied or unavailable.");
    }
}

function switchCamera() {
    useFrontCamera = !useFrontCamera;
    startCamera();
}

startCamera();

function setFilter(filterString, btn) {
    currentFilter = filterString;
    video.style.filter = filterString;
    document.querySelectorAll('#filters button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function startCountdownAndCapture() {
    const captureBtn = document.querySelector('.capture-btn');
    const countdownEl = document.getElementById('countdown-display');
    captureBtn.disabled = true;

    countdownEl.style.display = 'block';
    for (let i = 3; i > 0; i--) {
        countdownEl.innerText = i;
        await new Promise(r => setTimeout(r, 1000));
    }
    countdownEl.style.display = 'none';

    triggerFlashAndSound();
    triggerConfetti();
    await takePhotoAction();

    captureBtn.disabled = false;
    captureBtn.innerText = "📷 Snap Another";
}

function triggerFlashAndSound() {
    const flash = document.getElementById('flash-overlay');
    flash.classList.remove('flash-active');
    void flash.offsetWidth;
    flash.classList.add('flash-active');

    const shutter = document.getElementById('shutter-sound');
    if (shutter) {
        shutter.currentTime = 0;
        shutter.play().catch(e => console.log("Audio play blocked"));
    }
}

function triggerConfetti() {
    confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff758c', '#ff7eb3', '#ffffff', '#ffd166']
    });
}

async function takePhotoAction() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        ctx.filter = currentFilter;

        // Fix: Flip the photo data so it saves exactly how the mirror preview looked
        if (useFrontCamera) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Reset the flip BEFORE drawing the logo so the text isn't backwards!
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.filter = 'none';
        
        // Stamp Logo
        if (stampLogo.complete && stampLogo.naturalWidth !== 0) {
            ctx.globalCompositeOperation = 'screen'; 
            const wmWidth = canvas.width * 0.22; 
            const wmHeight = (stampLogo.naturalHeight / stampLogo.naturalWidth) * wmWidth;
            const padding = canvas.width * 0.04;
            ctx.drawImage(stampLogo, canvas.width - wmWidth - padding, canvas.height - wmHeight - padding, wmWidth, wmHeight);
            ctx.globalCompositeOperation = 'source-over'; 
        }

        const base64Data = canvas.toDataURL('image/jpeg', 0.9);

        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Data })
        });
        
        if (!res.ok) throw new Error("Server error.");
        const data = await res.json();
        
        const qrContainer = document.getElementById('qr-container');
        const qrCanvas = document.getElementById('qrcode');
        qrContainer.style.display = 'flex';
        
        QRCode.toCanvas(qrCanvas, data.downloadUrl, { width: 220, margin: 2 }, (error) => {
            if (error) console.error("QR Error:", error);
        });

    } catch (err) {
        console.error(err);
        alert("Upload failed.");
    }
}