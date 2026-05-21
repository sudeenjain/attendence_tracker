const API_BASE = '/api';

// DOM Elements
const navDashboard = document.getElementById('nav-dashboard');
const navScanner = document.getElementById('nav-scanner');
const navRegister = document.getElementById('nav-register');

const viewDashboard = document.getElementById('view-dashboard');
const viewScanner = document.getElementById('view-scanner');
const viewRegister = document.getElementById('view-register');

const statCount = document.getElementById('stat-count');
const statLast = document.getElementById('stat-last');
const attendanceLogBody = document.getElementById('attendance-log-body');

const scannerVideo = document.getElementById('scanner-video');
const scannerStatus = document.getElementById('scanner-status');
const scanFrame = document.querySelector('.scan-frame');
const recognizedCard = document.getElementById('recognized-user-card');
const rcName = document.getElementById('rc-name');
const rcUsn = document.getElementById('rc-usn');
const rcBranch = document.getElementById('rc-branch');

const registerVideo = document.getElementById('register-video');
const registerForm = document.getElementById('register-form');
const regNameInput = document.getElementById('reg-name');
const regUsnInput = document.getElementById('reg-usn');
const regBranchInput = document.getElementById('reg-branch');
const registerStatus = document.getElementById('register-status');
const btnCapture = document.getElementById('btn-capture');

// State
let labeledFaceDescriptors = [];
let faceMatcher = null;
let usersMap = {};
let isScannerActive = false;
let isRegisterActive = false;
let activeStream = null;

// Initialize App
async function init() {
    try {
        scannerStatus.textContent = "Loading Face-API Models...";
        scannerStatus.className = "status-message status-info";
        
        // Load Models
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        
        scannerStatus.textContent = "Models loaded. Fetching users...";
        await fetchUsers(); // load enrolled users
        
        scannerStatus.textContent = "System Ready.";
        scannerStatus.className = "status-message status-success";
        
        // Setup Navigation
        setupNavigation();
        
        // Load Dashboard
        updateDashboard();
        setInterval(updateDashboard, 5000); // Polling every 5s
        
    } catch (err) {
        console.error("Initialization Error:", err);
        scannerStatus.textContent = "Error initializing AI models.";
        scannerStatus.className = "status-message status-error";
    }
}

// Fetch enrolled users from DB and create FaceMatcher
async function fetchUsers() {
    try {
        const res = await fetch(`${API_BASE}/users`);
        const users = await res.json();
        
        usersMap = {}; // Reset map
        if (users.length > 0) {
            labeledFaceDescriptors = users.map(user => {
                usersMap[user.id] = { name: user.name, usn: user.usn, branch: user.branch };
                // Ensure descriptor is Float32Array
                const descriptorArray = new Float32Array(Object.values(user.descriptor));
                // We use user.id as the label so we can send it back to the API
                return new faceapi.LabeledFaceDescriptors(user.id.toString(), [descriptorArray]);
            });
            faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
        } else {
            faceMatcher = null;
        }
    } catch (err) {
        console.error("Failed to fetch users", err);
    }
}

// Navigation Logic
function setupNavigation() {
    navDashboard.addEventListener('click', () => switchView('dashboard'));
    navScanner.addEventListener('click', () => switchView('scanner'));
    navRegister.addEventListener('click', () => switchView('register'));
}

async function switchView(view) {
    // Reset Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    
    // Stop camera stream & clear canvases
    stopCamera();
    clearCanvases();
    isScannerActive = false;
    isRegisterActive = false;

    if (view === 'dashboard') {
        navDashboard.classList.add('active');
        viewDashboard.classList.add('active-view');
        updateDashboard();
    } else if (view === 'scanner') {
        navScanner.classList.add('active');
        viewScanner.classList.add('active-view');
        isScannerActive = true;
        await startCamera(scannerVideo);
        runScanner();
    } else if (view === 'register') {
        navRegister.classList.add('active');
        viewRegister.classList.add('active-view');
        isRegisterActive = true;
        registerStatus.textContent = '';
        regNameInput.value = '';
        regUsnInput.value = '';
        regBranchInput.value = '';
        await startCamera(registerVideo);
        runRegisterTracker();
    }
}

// Camera Helper
async function startCamera(videoElement) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        videoElement.srcObject = stream;
        activeStream = stream;
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => resolve(videoElement);
        });
    } catch (err) {
        console.error("Error accessing webcam", err);
        alert("Webcam access denied or unavailable.");
    }
}

function stopCamera() {
    if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
        activeStream = null;
    }
}

// Canvas Helpers
function getOrAddCanvas(video) {
    const parent = video.parentElement;
    let canvas = parent.querySelector('canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.transform = 'scaleX(-1)'; // Match video horizontal mirror
        parent.appendChild(canvas);
    }
    return canvas;
}

function clearCanvases() {
    document.querySelectorAll('.video-wrapper canvas').forEach(canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
}

// Drawing function for Scanner HUD
function drawScannerHUD(canvas, detection, isLivenessVerified, isBlinkDetected, ear) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!detection) return;
    
    const displaySize = { width: canvas.width, height: canvas.height };
    const resizedDetection = faceapi.resizeResults(detection, displaySize);
    const { x, y, width, height } = resizedDetection.detection.box;
    
    // Draw Face Landmarks in semi-transparent cyan
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetection, { drawLines: true, color: 'rgba(14, 165, 233, 0.4)' });
    
    // Choose status HUD styling based on active detection state
    let hudColor = '#6366f1'; // Purple default
    let statusText = 'SCANNING FACE BIOMETRICS...';
    
    if (isLivenessVerified) {
        hudColor = '#10b981'; // Emerald Green
        statusText = 'LIVENESS VERIFIED ✔';
    } else if (isBlinkDetected) {
        hudColor = '#38bdf8'; // Glowing sky-blue
        statusText = 'BLINK DETECTED! RECOGNIZING...';
    } else {
        hudColor = '#ec4899'; // Hot pink to draw attention
        statusText = `ANTI-SPOOF: BLINK NOW! (EAR: ${(ear || 0).toFixed(2)})`;
    }
    
    // Draw Holographic corner brackets
    ctx.strokeStyle = hudColor;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 15;
    ctx.shadowColor = hudColor;
    
    const r = 20; // length of corner bars
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x, y); ctx.lineTo(x, y + r);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(x, y + height - r); ctx.lineTo(x, y + height); ctx.lineTo(x + r, y + height);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(x + width - r, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - r);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(x + width, y + r); ctx.lineTo(x + width, y); ctx.lineTo(x + width - r, y);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    
    // Draw thin bounding box border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    
    // Draw Status Bar above head
    const boxWidth = Math.max(width, 240);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(x, y - 35, boxWidth, 26);
    ctx.strokeStyle = hudColor;
    ctx.strokeRect(x, y - 35, boxWidth, 26);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 11px "Outfit", sans-serif';
    ctx.fillText(statusText.toUpperCase(), x + 10, y - 18);
}

// Drawing function for Register HUD
function drawRegisterHUD(canvas, detection) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!detection) return;
    
    const displaySize = { width: canvas.width, height: canvas.height };
    const resizedDetection = faceapi.resizeResults(detection, displaySize);
    const { x, y, width, height } = resizedDetection.detection.box;
    
    // Draw landmarks
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetection, { drawLines: true, color: 'rgba(236, 72, 153, 0.4)' });
    
    const hudColor = '#ec4899'; // Hot pink register theme
    
    // Corner brackets
    ctx.strokeStyle = hudColor;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 15;
    ctx.shadowColor = hudColor;
    
    const r = 20;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x, y); ctx.lineTo(x, y + r);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(x, y + height - r); ctx.lineTo(x, y + height); ctx.lineTo(x + r, y + height);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(x + width - r, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - r);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(x + width, y + r); ctx.lineTo(x + width, y); ctx.lineTo(x + width - r, y);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    
    // Thin box
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    
    // Status box
    const boxWidth = Math.max(width, 180);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(x, y - 35, boxWidth, 26);
    ctx.strokeStyle = hudColor;
    ctx.strokeRect(x, y - 35, boxWidth, 26);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 11px "Outfit", sans-serif';
    ctx.fillText("READY TO ACQUIRE FACE", x + 10, y - 18);
}

// Scanner Logic (Attendance Logging)
let recentlyLogged = new Set();
let livenessVerified = false;
let isBlinking = false;

// Euclidean distance helper for EAR
function euclideanDistance(point1, point2) {
    return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2));
}

// Compute Eye Aspect Ratio (EAR)
function getEAR(eye) {
    const v1 = euclideanDistance(eye[1], eye[5]);
    const v2 = euclideanDistance(eye[2], eye[4]);
    const h = euclideanDistance(eye[0], eye[3]);
    return (v1 + v2) / (2.0 * h);
}

async function runScanner() {
    if (!isScannerActive) return;

    if (!faceMatcher) {
        scannerStatus.textContent = "No users enrolled yet. Please register faces first.";
        scannerStatus.className = "status-message status-info";
    } else {
        scannerStatus.textContent = "Scanning for faces...";
        scannerStatus.className = "status-message";
    }

    async function scanLoop() {
        if (!isScannerActive) return;

        try {
            let detection;
            if (!livenessVerified) {
                detection = await faceapi.detectSingleFace(scannerVideo).withFaceLandmarks();
            } else {
                detection = await faceapi.detectSingleFace(scannerVideo).withFaceLandmarks().withFaceDescriptor();
            }

            const canvas = getOrAddCanvas(scannerVideo);

            if (detection && scannerVideo.clientWidth > 0) {
                const displaySize = { width: scannerVideo.clientWidth, height: scannerVideo.clientHeight };
                faceapi.matchDimensions(canvas, displaySize);

                if (!livenessVerified) {
                    // Liveness Detection via EAR
                    const leftEye = detection.landmarks.getLeftEye();
                    const rightEye = detection.landmarks.getRightEye();

                    const leftEAR = getEAR(leftEye);
                    const rightEAR = getEAR(rightEye);
                    const ear = (leftEAR + rightEAR) / 2;

                    // Eye Aspect Ratio threshold (0.19 is standard for closed eye)
                    if (ear < 0.19) {
                        isBlinking = true;
                    } else if (ear >= 0.19 && isBlinking) {
                        isBlinking = false;
                        livenessVerified = true;
                    }

                    // Render futuristic scanning brackets with EAR metrics
                    drawScannerHUD(canvas, detection, false, isBlinking, ear);

                    if (!isBlinking) {
                        scannerStatus.textContent = "Liveness Check: Please blink to log attendance.";
                        scannerStatus.className = "status-message status-info";
                    } else {
                        scannerStatus.textContent = "Blink detected! Verifying identity...";
                    }
                } else {
                    // Liveness approved! Draw HUD as verified
                    drawScannerHUD(canvas, detection, true, false);

                    // Match face
                    const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
                    
                    if (bestMatch.label !== 'unknown') {
                        const userId = bestMatch.label;
                        const distance = bestMatch.distance.toFixed(2);
                        const user = usersMap[userId];
                        
                        // Flash green scanner box success state
                        scanFrame.classList.add('success');
                        setTimeout(() => scanFrame.classList.remove('success'), 1000);

                        // Reveal user details pop-up
                        if (user) {
                            rcName.textContent = user.name;
                            rcUsn.textContent = user.usn;
                            rcBranch.textContent = user.branch;
                            recognizedCard.style.display = 'block';
                            setTimeout(() => recognizedCard.style.display = 'none', 4000);
                        }

                        // Log Attendance if not recently logged
                        if (!recentlyLogged.has(userId)) {
                            logAttendance(userId, bestMatch.distance);
                            recentlyLogged.add(userId);
                            setTimeout(() => recentlyLogged.delete(userId), 300000); // 5 min local rate limit
                            
                            // Reset liveness check for next user after 4s
                            setTimeout(() => { livenessVerified = false; }, 4000);
                        }
                    } else {
                        scannerStatus.textContent = "Face not recognized. Enrollment required.";
                        scannerStatus.className = "status-message status-error";
                        livenessVerified = false; // Reset on failure
                    }
                }
            } else {
                // Clear canvas if no face detected
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                if (faceMatcher) {
                    scannerStatus.textContent = "Scanning... Align face inside guide.";
                    scannerStatus.className = "status-message status-info";
                }
            }
        } catch (err) {
            console.error("Scanner Loop Error", err);
        }
        
        // Loop frame
        setTimeout(scanLoop, 150);
    }
    
    scanLoop();
}

// Real-time facial registration feedback loop
async function runRegisterTracker() {
    if (!isRegisterActive) return;

    try {
        const detection = await faceapi.detectSingleFace(registerVideo).withFaceLandmarks();
        const canvas = getOrAddCanvas(registerVideo);
        
        if (detection && registerVideo.clientWidth > 0) {
            const displaySize = { width: registerVideo.clientWidth, height: registerVideo.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);
            drawRegisterHUD(canvas, detection);
        } else {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    } catch (err) {
        console.error("Register Tracker Error:", err);
    }

    setTimeout(runRegisterTracker, 150);
}

async function logAttendance(userId, distance) {
    try {
        scannerStatus.textContent = "Logging attendance...";
        scannerStatus.className = "status-message status-info";

        const res = await fetch(`${API_BASE}/attend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: parseInt(userId) })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            const confidence = ((1 - distance) * 100).toFixed(0);
            scannerStatus.textContent = `Attendance logged! Match: ${confidence}% Confidence`;
            scannerStatus.className = "status-message status-success";
        } else if (res.status === 429) {
            scannerStatus.textContent = "Attendance already logged recently.";
            scannerStatus.className = "status-message status-info";
        } else {
            throw new Error(data.error);
        }
    } catch (err) {
        scannerStatus.textContent = "Failed to log attendance.";
        scannerStatus.className = "status-message status-error";
    }
}

// Registration Logic
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isRegisterActive) return;

    const name = regNameInput.value.trim();
    const usn = regUsnInput.value.trim();
    const branch = regBranchInput.value.trim();
    if (!name || !usn || !branch) return;

    btnCapture.disabled = true;
    btnCapture.textContent = "Processing Face...";
    registerStatus.textContent = "Analyzing facial geometry. Hold still...";
    registerStatus.className = "status-message status-info";

    try {
        const detection = await faceapi.detectSingleFace(registerVideo)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            registerStatus.textContent = "No face detected! Move closer or improve lighting.";
            registerStatus.className = "status-message status-error";
            btnCapture.disabled = false;
            btnCapture.textContent = "Capture & Register";
            return;
        }

        if (detection.detection.score < 0.8) {
            registerStatus.textContent = "Face not clear. Look directly at camera in good lighting.";
            registerStatus.className = "status-message status-error";
            btnCapture.disabled = false;
            btnCapture.textContent = "Capture & Register";
            return;
        }

        // Convert Float32Array to standard Array for JSON
        const descriptorArray = Array.from(detection.descriptor);

        // Send to backend
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, usn, branch, descriptor: descriptorArray })
        });

        const data = await res.json();
        if (res.ok) {
            registerStatus.textContent = "Successfully Registered! You can now scan.";
            registerStatus.className = "status-message status-success";
            regNameInput.value = '';
            regUsnInput.value = '';
            regBranchInput.value = '';
            
            // Reload face matcher
            await fetchUsers();
        } else {
            throw new Error(data.error);
        }
    } catch (err) {
        console.error("Registration flow error", err);
        registerStatus.textContent = err.message || "Failed to register. Server error.";
        registerStatus.className = "status-message status-error";
    } finally {
        setTimeout(() => {
            btnCapture.disabled = false;
            btnCapture.textContent = "Capture & Register";
        }, 2000);
    }
});

// Dashboard Logic
async function updateDashboard() {
    try {
        const res = await fetch(`${API_BASE}/attendance`);
        const logs = await res.json();
        
        statCount.textContent = logs.length;
        
        attendanceLogBody.innerHTML = '';
        if (logs.length === 0) {
            statLast.textContent = "-";
            attendanceLogBody.innerHTML = `<tr><td colspan="5" class="empty-state">No attendance logged today.</td></tr>`;
            return;
        }

        const lastLog = logs[0];
        const lastTime = new Date(lastLog.timestamp);
        statLast.textContent = isNaN(lastTime.getTime()) 
            ? new Date(lastLog.timestamp + ' UTC').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : lastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        logs.forEach(log => {
            const timeObj = new Date(log.timestamp);
            const timeStr = isNaN(timeObj.getTime())
                ? new Date(log.timestamp + ' UTC').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${log.name}</strong></td>
                <td><span class="usn-badge">${log.usn}</span></td>
                <td>${log.branch}</td>
                <td>${timeStr}</td>
                <td><span class="status-badge">Present</span></td>
            `;
            attendanceLogBody.appendChild(tr);
        });
    } catch (err) {
        console.error("Failed to update dashboard", err);
    }
}

// Start app
window.onload = init;
