import { CPU } from './cpu.js';
import { PPU } from './ppu.js';
import { APU } from './apu.js';
import { Memory } from './memory.js';
import { Input } from './input.js';

export class NES {
    constructor() {
        this.memory = new Memory();
        this.cpu = new CPU(this.memory);
        this.ppu = new PPU(this.memory);
        this.apu = new APU();
        this.input = new Input();
        
        this.canvas = document.getElementById('nesCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.running = false;
        this.romLoaded = false;
        this.frameCount = 0;
        this.lastTime = 0;
        this.fps = 0;
        
        this.initializeUI();
        this.gameLoop = this.gameLoop.bind(this);
    }
    
    initializeUI() {
        const romFile = document.getElementById('romFile');
        const playPause = document.getElementById('playPause');
        const reset = document.getElementById('reset');
        const fullscreen = document.getElementById('fullscreen');
        const loading = document.getElementById('loading');
        
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
    
    async loadROM(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const romData = new Uint8Array(arrayBuffer);
            
            // Parse iNES header
            const header = this.parseINESHeader(romData);
            if (!header) {
                throw new Error('Invalid ROM format');
            }
            
            // Load ROM data into memory
            this.memory.loadROM(romData, header);
            
            // Initialize components
            this.cpu.reset();
            this.ppu.reset();
            this.apu.reset();
            
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
        requestAnimationFrame(this.gameLoop);
    }
    
    pause() {
        this.running = false;
        document.getElementById('playPause').textContent = 'Play';
    }
    
    reset() {
        this.cpu.reset();
        this.ppu.reset();
        this.apu.reset();
        this.frameCount = 0;
        
        if (this.running) {
            this.play();
        }
    }
    
    gameLoop(currentTime) {
        if (!this.running) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Calculate FPS
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.fps = Math.round(1000 / deltaTime);
        }
        
        // Run emulation
        this.emulateCycle();
        
        // Update debug info
        this.updateDebugInfo();
        
        requestAnimationFrame(this.gameLoop);
    }
    
    emulateCycle() {
        // CPU runs at ~1.79MHz, PPU at ~5.37MHz (3x CPU)
        // Target 60 FPS, so we need ~29,830 CPU cycles per frame
        const cpuCyclesPerFrame = 29830;
        
        for (let i = 0; i < cpuCyclesPerFrame; i++) {
            // Execute CPU instruction
            const cpuCycles = this.cpu.step();
            
            // PPU runs 3 cycles for every CPU cycle
            for (let j = 0; j < cpuCycles * 3; j++) {
                this.ppu.step();
            }
            
            // APU runs at same speed as CPU
            this.apu.step();
            
            // Check for interrupts
            if (this.ppu.nmiFlag) {
                this.cpu.nmi();
                this.ppu.nmiFlag = false;
            }
        }
        
        // Render frame
        this.render();
    }
    
    render() {
        const frameBuffer = this.ppu.getFrameBuffer();
        const imageData = this.ctx.createImageData(256, 240);
        
        for (let i = 0; i < frameBuffer.length; i++) {
            const pixel = frameBuffer[i];
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
                PC: $${this.cpu.pc.toString(16).toUpperCase().padStart(4, '0')}<br>
                A: $${this.cpu.a.toString(16).toUpperCase().padStart(2, '0')}<br>
                X: $${this.cpu.x.toString(16).toUpperCase().padStart(2, '0')}<br>
                Y: $${this.cpu.y.toString(16).toUpperCase().padStart(2, '0')}<br>
                SP: $${this.cpu.sp.toString(16).toUpperCase().padStart(2, '0')}<br>
                P: $${this.cpu.p.toString(16).toUpperCase().padStart(2, '0')}<br>
                Frame: ${this.frameCount}
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
    window.nes = new NES();
});

