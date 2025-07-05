// Verbose logging system
class Logger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
        this.paused = false;
        this.element = null;
        this.autoScroll = true;
    }
    
    init() {
        this.element = document.getElementById('logOutput');
        document.getElementById('clearLogs').addEventListener('click', () => this.clear());
        document.getElementById('pauseLogs').addEventListener('click', () => this.togglePause());
        document.getElementById('autoScroll').addEventListener('change', (e) => {
            this.autoScroll = e.target.checked;
        });
    }
    
    log(level, message, data = null) {
        if (this.paused) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };
        
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        this.render();
        console.log(`[${level}] ${message}`, data || '');
    }
    
    info(message, data) { this.log('INFO', message, data); }
    warn(message, data) { this.log('WARN', message, data); }
    error(message, data) { this.log('ERROR', message, data); }
    debug(message, data) { this.log('DEBUG', message, data); }
    
    clear() {
        this.logs = [];
        this.render();
    }
    
    togglePause() {
        this.paused = !this.paused;
        document.getElementById('pauseLogs').textContent = this.paused ? 'Resume' : 'Pause';
    }
    
    render() {
        if (!this.element) return;
        
        const html = this.logs.map(log => `
            <div class="log-entry log-${log.level.toLowerCase()}">
                <span class="log-time">${log.timestamp}</span>
                <span class="log-level">[${log.level}]</span>
                <span class="log-message">${log.message}</span>
                ${log.data ? `<pre class="log-data">${JSON.stringify(log.data, null, 2)}</pre>` : ''}
            </div>
        `).join('');
        
        this.element.innerHTML = html;
        
        if (this.autoScroll) {
            this.element.scrollTop = this.element.scrollHeight;
        }
    }
}

export class NES {
    constructor() {
        this.logger = new Logger();
        this.nes = new window.jsnes.NES({
            onFrame: this.onFrame.bind(this),
            onAudioSample: this.onAudioSample.bind(this),
            onStatusUpdate: this.onStatusUpdate.bind(this)
        });
        
        this.canvas = document.getElementById('nesCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.imageData = this.ctx.createImageData(256, 240);
        
        this.running = false;
        this.romLoaded = false;
        this.frameCount = 0;
        this.fps = 0;
        this.fpsCounter = 0;
        this.lastFpsTime = 0;
        
        this.audioContext = null;
        this.audioBuffer = [];
        this.audioBufferSize = 4096;
        
        this.initializeUI();
        this.initializeAudio();
        
        this.logger.info('NES Emulator initialized', {
            jsnesVersion: window.jsnes.version || 'unknown',
            canvasSize: `${this.canvas.width}x${this.canvas.height}`
        });
    }
    
    initializeUI() {
        this.logger.info('Initializing UI components');
        
        const romFile = document.getElementById('romFile');
        const playPause = document.getElementById('playPause');
        const reset = document.getElementById('reset');
        const fullscreen = document.getElementById('fullscreen');
        const toggleLogs = document.getElementById('toggleLogs');
        
        romFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.logger.info('ROM file selected', { name: file.name, size: file.size });
                this.loadROM(file);
            }
        });
        
        playPause.addEventListener('click', () => {
            if (this.romLoaded) {
                this.togglePlayPause();
            } else {
                this.logger.warn('Cannot play/pause - no ROM loaded');
            }
        });
        
        reset.addEventListener('click', () => {
            if (this.romLoaded) {
                this.logger.info('Reset button clicked');
                this.reset();
            } else {
                this.logger.warn('Cannot reset - no ROM loaded');
            }
        });
        
        fullscreen.addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        toggleLogs.addEventListener('click', () => {
            this.toggleVerboseLogs();
        });
        
        // Initialize logger UI
        this.logger.init();
        
        // Initialize keyboard controls
        this.initializeControls();
        
        // Debug toggle
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12') {
                e.preventDefault();
                this.toggleDebug();
            }
        });
        
        this.logger.info('UI initialization complete');
    }
    
    initializeControls() {
        this.logger.info('Initializing keyboard controls');
        
        const keyMap = {
            'ArrowUp': [1, window.jsnes.Controller.BUTTON_UP],
            'ArrowDown': [1, window.jsnes.Controller.BUTTON_DOWN],
            'ArrowLeft': [1, window.jsnes.Controller.BUTTON_LEFT],
            'ArrowRight': [1, window.jsnes.Controller.BUTTON_RIGHT],
            'KeyX': [1, window.jsnes.Controller.BUTTON_A],
            'KeyZ': [1, window.jsnes.Controller.BUTTON_B],
            'Enter': [1, window.jsnes.Controller.BUTTON_START],
            'ShiftLeft': [1, window.jsnes.Controller.BUTTON_SELECT],
            'ShiftRight': [1, window.jsnes.Controller.BUTTON_SELECT]
        };
        
        document.addEventListener('keydown', (e) => {
            const mapping = keyMap[e.code];
            if (mapping) {
                e.preventDefault();
                this.nes.buttonDown(mapping[0], mapping[1]);
                this.logger.debug('Key pressed', { key: e.code, player: mapping[0], button: mapping[1] });
            }
        });
        
        document.addEventListener('keyup', (e) => {
            const mapping = keyMap[e.code];
            if (mapping) {
                e.preventDefault();
                this.nes.buttonUp(mapping[0], mapping[1]);
                this.logger.debug('Key released', { key: e.code, player: mapping[0], button: mapping[1] });
            }
        });
    }
    
    initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.logger.info('Audio context initialized', { 
                sampleRate: this.audioContext.sampleRate,
                state: this.audioContext.state 
            });
        } catch (error) {
            this.logger.error('Failed to initialize audio context', error);
        }
    }
    
    async loadROM(file) {
        this.logger.info('Loading ROM file', { name: file.name, size: file.size });
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const romData = new Uint8Array(arrayBuffer);
            
            this.logger.info('ROM data loaded', { 
                size: romData.length,
                header: Array.from(romData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
            });
            
            // Load ROM into JSNES using Uint8Array directly
            this.nes.loadROM(romData);
            
            this.romLoaded = true;
            this.updateROMInfo(file.name, romData);
            
            document.getElementById('loading').style.display = 'none';
            document.getElementById('playPause').textContent = 'Play';
            document.getElementById('playPause').disabled = false;
            document.getElementById('reset').disabled = false;
            
            this.logger.info('ROM loaded successfully');
            
        } catch (error) {
            this.logger.error('Error loading ROM', error);
            alert('Error loading ROM: ' + error.message);
        }
    }
    
    updateROMInfo(filename, romData) {
        // Parse iNES header
        const header = {
            signature: Array.from(romData.slice(0, 4)).map(b => String.fromCharCode(b)).join(''),
            prgRomSize: romData[4] * 16384,
            chrRomSize: romData[5] * 8192,
            mapper: (romData[6] >> 4) | (romData[7] & 0xF0),
            mirroring: romData[6] & 0x01,
            battery: (romData[6] & 0x02) !== 0,
            trainer: (romData[6] & 0x04) !== 0,
            fourScreen: (romData[6] & 0x08) !== 0
        };
        
        this.logger.info('ROM header parsed', header);
        
        const romDetails = document.getElementById('romDetails');
        romDetails.innerHTML = `
            <div><strong>File:</strong> ${filename}</div>
            <div><strong>Signature:</strong> ${header.signature}</div>
            <div><strong>PRG ROM:</strong> ${header.prgRomSize / 1024}KB</div>
            <div><strong>CHR ROM:</strong> ${header.chrRomSize / 1024}KB</div>
            <div><strong>Mapper:</strong> ${header.mapper}</div>
            <div><strong>Mirroring:</strong> ${header.mirroring ? 'Vertical' : 'Horizontal'}</div>
            <div><strong>Battery:</strong> ${header.battery ? 'Yes' : 'No'}</div>
        `;
    }
    
    togglePlayPause() {
        if (this.running) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        if (!this.romLoaded) {
            this.logger.warn('Cannot play - no ROM loaded');
            return;
        }
        
        this.logger.info('Starting emulation');
        this.running = true;
        document.getElementById('playPause').textContent = 'Pause';
        this.lastFpsTime = performance.now();
        
        // Start FPS counter
        this.startFpsCounter();
        
        // Start JSNES emulation
        this.nes.start();
    }
    
    pause() {
        this.logger.info('Pausing emulation');
        this.running = false;
        document.getElementById('playPause').textContent = 'Play';
        
        // Stop JSNES emulation
        this.nes.stop();
        
        // Stop FPS counter
        this.stopFpsCounter();
    }
    
    reset() {
        this.logger.info('Resetting emulator');
        this.nes.reset();
        this.frameCount = 0;
        this.fpsCounter = 0;
        
        if (this.running) {
            this.nes.start();
        }
    }
    
    startFpsCounter() {
        this.fpsInterval = setInterval(() => {
            this.fps = this.fpsCounter;
            this.fpsCounter = 0;
            this.logger.debug('FPS update', { fps: this.fps });
            this.updateDebugInfo();
        }, 1000);
    }
    
    stopFpsCounter() {
        if (this.fpsInterval) {
            clearInterval(this.fpsInterval);
            this.fpsInterval = null;
        }
    }
    
    gameLoop(currentTime) {
        if (!this.running) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Calculate FPS
        this.fpsCounter++;
        if (currentTime - this.lastFpsTime >= 1000) {
            this.fps = this.fpsCounter;
            this.fpsCounter = 0;
            this.lastFpsTime = currentTime;
            this.logger.debug('FPS update', { fps: this.fps, deltaTime: deltaTime.toFixed(2) });
        }
        
        // Run emulation frame
        try {
            this.nes.frame();
            this.frameCount++;
        } catch (error) {
            this.logger.error('Error during frame execution', error);
            this.pause();
            return;
        }
        
        // Update debug info
        this.updateDebugInfo();
        
        requestAnimationFrame(this.gameLoop);
    }
    
    onFrame(frameBuffer) {
        // Convert JSNES frame buffer to canvas
        for (let i = 0; i < frameBuffer.length; i++) {
            const pixel = frameBuffer[i];
            const index = i * 4;
            this.imageData.data[index] = (pixel >> 16) & 0xFF;     // R
            this.imageData.data[index + 1] = (pixel >> 8) & 0xFF;  // G
            this.imageData.data[index + 2] = pixel & 0xFF;         // B
            this.imageData.data[index + 3] = 0xFF;                 // A
        }
        
        this.ctx.putImageData(this.imageData, 0, 0);
        this.frameCount++;
        this.fpsCounter++;
    }
    
    onAudioSample(left, right) {
        if (!this.audioContext) return;
        
        this.audioBuffer.push(left, right);
        
        if (this.audioBuffer.length >= this.audioBufferSize) {
            // Process audio buffer
            this.audioBuffer = [];
        }
    }
    
    onStatusUpdate(status) {
        this.logger.debug('Status update', status);
    }
    
    onBatteryRamWrite(address, value) {
        this.logger.debug('Battery RAM write', { address: address.toString(16), value: value.toString(16) });
    }
    
    toggleDebug() {
        const debugPanel = document.getElementById('debugPanel');
        debugPanel.classList.toggle('active');
        this.logger.info('Debug panel toggled', { active: debugPanel.classList.contains('active') });
    }
    
    toggleVerboseLogs() {
        const logsPanel = document.getElementById('verboseLogs');
        logsPanel.classList.toggle('active');
        this.logger.info('Verbose logs toggled', { active: logsPanel.classList.contains('active') });
    }
    
    updateDebugInfo() {
        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo && this.romLoaded) {
            debugInfo.innerHTML = `
                <div class="debug-section">
                    <h4>Performance</h4>
                    FPS: ${this.fps}<br>
                    Frame: ${this.frameCount}<br>
                    Running: ${this.running ? 'Yes' : 'No'}
                </div>
                <div class="debug-section">
                    <h4>Emulator State</h4>
                    ROM Loaded: ${this.romLoaded ? 'Yes' : 'No'}<br>
                    Audio Context: ${this.audioContext ? this.audioContext.state : 'None'}
                </div>
            `;
        }
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.canvas.requestFullscreen();
            this.logger.info('Entering fullscreen mode');
        } else {
            document.exitFullscreen();
            this.logger.info('Exiting fullscreen mode');
        }
    }
}

// Initialize NES emulator when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.nesEmulator = new NES();
});