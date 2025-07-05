export class NESEmulator {
    constructor() {
        this.nes = null;
        this.canvas = document.getElementById('nesCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.running = false;
        this.romLoaded = false;
        this.frameCount = 0;
        this.lastTime = 0;
        this.fps = 60;
        this.lastFpsTime = 0;
        this.frameBuffer = new Array(256 * 240);
        
        this.controllers = {
            1: new jsnes.Controller(),
            2: new jsnes.Controller()
        };
        
        this.keyMap = {
            'KeyX': jsnes.Controller.BUTTON_A,
            'KeyZ': jsnes.Controller.BUTTON_B,
            'ShiftLeft': jsnes.Controller.BUTTON_SELECT,
            'ShiftRight': jsnes.Controller.BUTTON_SELECT,
            'Enter': jsnes.Controller.BUTTON_START,
            'ArrowUp': jsnes.Controller.BUTTON_UP,
            'ArrowDown': jsnes.Controller.BUTTON_DOWN,
            'ArrowLeft': jsnes.Controller.BUTTON_LEFT,
            'ArrowRight': jsnes.Controller.BUTTON_RIGHT
        };
        
        this.initializeNES();
        this.initializeUI();
        this.initializeControls();
        this.gameLoop = this.gameLoop.bind(this);
    }
    
    initializeNES() {
        this.nes = new jsnes.NES({
            onFrame: (frameBuffer) => {
                this.frameBuffer = frameBuffer;
                this.render();
            },
            onStatusUpdate: (status) => {
                console.log('Status:', status);
            },
            onAudioSample: (left, right) => {
                // Audio handling would go here
            }
        });
    }
    
    initializeUI() {
        const romFile = document.getElementById('romFile');
        const playPause = document.getElementById('playPause');
        const reset = document.getElementById('reset');
        const fullscreen = document.getElementById('fullscreen');
        
        romFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadROM(file);
            }
        });
        
        playPause.addEventListener('click', () => {
            if (this.romLoaded) {
                this.togglePlayPause();
            }
        });
        
        reset.addEventListener('click', () => {
            if (this.romLoaded) {
                this.reset();
            }
        });
        
        fullscreen.addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        // Debug toggle
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12') {
                e.preventDefault();
                this.toggleDebug();
            }
        });
    }
    
    initializeControls() {
        document.addEventListener('keydown', (e) => {
            const button = this.keyMap[e.code];
            if (button !== undefined) {
                e.preventDefault();
                this.controllers[1].buttonDown(button);
            }
        });
        
        document.addEventListener('keyup', (e) => {
            const button = this.keyMap[e.code];
            if (button !== undefined) {
                e.preventDefault();
                this.controllers[1].buttonUp(button);
            }
        });
    }
    
    async loadROM(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const romData = new Uint8Array(arrayBuffer);
            
            // Parse basic ROM info
            const header = this.parseINESHeader(romData);
            if (!header) {
                throw new Error('Invalid ROM format');
            }
            
            // Load ROM into JSNES
            this.nes.loadROM(romData);
            
            this.romLoaded = true;
            this.updateROMInfo(header, file.name);
            
            document.getElementById('loading').style.display = 'none';
            document.getElementById('playPause').textContent = 'Play';
            document.getElementById('playPause').disabled = false;
            document.getElementById('reset').disabled = false;
            
        } catch (error) {
            console.error('Error loading ROM:', error);
            alert('Error loading ROM: ' + error.message);
        }
    }
    
    parseINESHeader(romData) {
        if (romData.length < 16) return null;
        
        // Check for "NES" signature
        if (romData[0] !== 0x4E || romData[1] !== 0x45 || romData[2] !== 0x53 || romData[3] !== 0x1A) {
            return null;
        }
        
        return {
            prgRomSize: romData[4] * 16384, // 16KB units
            chrRomSize: romData[5] * 8192,  // 8KB units
            mapper: (romData[6] >> 4) | (romData[7] & 0xF0),
            mirroring: romData[6] & 0x01,
            battery: (romData[6] & 0x02) !== 0,
            trainer: (romData[6] & 0x04) !== 0,
            fourScreen: (romData[6] & 0x08) !== 0
        };
    }
    
    updateROMInfo(header, filename) {
        const romDetails = document.getElementById('romDetails');
        romDetails.innerHTML = `
            <div><strong>File:</strong> ${filename}</div>
            <div><strong>PRG ROM:</strong> ${header.prgRomSize / 1024}KB</div>
            <div><strong>CHR ROM:</strong> ${header.chrRomSize / 1024}KB</div>
            <div><strong>Mapper:</strong> ${header.mapper}</div>
            <div><strong>Mirroring:</strong> ${header.mirroring ? 'Vertical' : 'Horizontal'}</div>
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
        if (!this.romLoaded) return;
        
        this.running = true;
        document.getElementById('playPause').textContent = 'Pause';
        this.lastTime = performance.now();
        this.lastFpsTime = performance.now();
        requestAnimationFrame(this.gameLoop);
    }
    
    pause() {
        this.running = false;
        document.getElementById('playPause').textContent = 'Play';
    }
    
    reset() {
        this.nes.reset();
        this.frameCount = 0;
        
        if (this.running) {
            this.play();
        }
    }
    
    gameLoop(currentTime) {
        if (!this.running) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Run emulation frame
        this.nes.buttonDown(1, this.controllers[1]);
        this.nes.frame();
        this.frameCount++;
        
        // Calculate FPS
        if (currentTime - this.lastFpsTime >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastFpsTime));
            this.lastFpsTime = currentTime;
            this.frameCount = 0;
        }
        
        // Update debug info
        this.updateDebugInfo();
        
        requestAnimationFrame(this.gameLoop);
    }
    
    render() {
        if (!this.frameBuffer) return;
        
        const imageData = this.ctx.createImageData(256, 240);
        
        for (let i = 0; i < this.frameBuffer.length; i++) {
            const pixel = this.frameBuffer[i];
            imageData.data[i * 4] = (pixel >> 16) & 0xFF;     // R
            imageData.data[i * 4 + 1] = (pixel >> 8) & 0xFF;  // G
            imageData.data[i * 4 + 2] = pixel & 0xFF;          // B
            imageData.data[i * 4 + 3] = 255;                   // A
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    toggleDebug() {
        const debugPanel = document.getElementById('debugPanel');
        debugPanel.classList.toggle('active');
    }
    
    updateDebugInfo() {
        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo && this.romLoaded) {
            debugInfo.innerHTML = `
                FPS: ${this.fps}<br>
                Frame: ${this.frameCount}<br>
                Running: ${this.running ? 'Yes' : 'No'}
            `;
        }
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.canvas.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
}

// Initialize NES emulator when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.nesEmulator = new NESEmulator();
});