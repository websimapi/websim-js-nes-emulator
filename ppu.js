export class PPU {
    constructor(memory) {
        this.memory = memory;
        this.reset();
    }
    
    reset() {
        this.cycle = 0;
        this.scanline = 0;
        this.frame = 0;
        this.nmiFlag = false;
        
        // PPU registers
        this.ctrl = 0;
        this.mask = 0;
        this.status = 0;
        this.oamAddr = 0;
        this.scroll = 0;
        this.addr = 0;
        this.data = 0;
        
        // Internal state
        this.vramAddr = 0;
        this.tempAddr = 0;
        this.fineX = 0;
        this.writeToggle = false;
        
        // Frame buffer (256x240 pixels)
        this.frameBuffer = new Uint32Array(256 * 240);
        
        // NES color palette
        this.palette = [
            0x666666, 0x002A88, 0x1412A7, 0x3B00A4, 0x5C007E, 0x6E0040, 0x6C0600, 0x561D00,
            0x333500, 0x0B4800, 0x005200, 0x004F08, 0x00404D, 0x000000, 0x000000, 0x000000,
            0xADADAD, 0x155FD9, 0x4240FF, 0x7527FE, 0xA01ACC, 0xB71E7B, 0xB53120, 0x994E00,
            0x6B6D00, 0x388700, 0x0C9300, 0x008F32, 0x007C8D, 0x000000, 0x000000, 0x000000,
            0xFFFEFF, 0x64B0FF, 0x9290FF, 0xC676FF, 0xF36AFF, 0xFE6ECC, 0xFE8170, 0xEA9E22,
            0xBCBE00, 0x88D800, 0x5CE430, 0x45E082, 0x48CDDE, 0x4F4F4F, 0x000000, 0x000000,
            0xFFFEFF, 0xC0DFFF, 0xD3D2FF, 0xE8C8FF, 0xFBC2FF, 0xFEC4EA, 0xFECCC5, 0xF7D8A5,
            0xE4E594, 0xCFEF96, 0xBDF4AB, 0xB3F3CC, 0xB5EBF2, 0xB8B8B8, 0x000000, 0x000000
        ];
    }
    
    step() {
        // Simplified PPU cycle
        if (this.scanline < 240) {
            // Visible scanlines
            if (this.cycle < 256) {
                this.renderPixel();
            }
        } else if (this.scanline === 241 && this.cycle === 1) {
            // VBlank start
            this.status |= 0x80; // Set VBlank flag
            if (this.ctrl & 0x80) {
                this.nmiFlag = true;
            }
        }
        
        this.cycle++;
        if (this.cycle >= 341) {
            this.cycle = 0;
            this.scanline++;
            if (this.scanline >= 262) {
                this.scanline = 0;
                this.frame++;
                this.status &= 0x7F; // Clear VBlank flag
            }
        }
    }
    
    renderPixel() {
        // Very basic rendering - just fill with a pattern for now
        const x = this.cycle;
        const y = this.scanline;
        const index = y * 256 + x;
        
        // Create a simple test pattern
        const colorIndex = ((x / 32) + (y / 32)) % 16;
        this.frameBuffer[index] = this.palette[colorIndex];
    }
    
    getFrameBuffer() {
        return this.frameBuffer;
    }
    
    readRegister(addr) {
        switch (addr) {
            case 0x2002: // PPUSTATUS
                const status = this.status;
                this.status &= 0x7F; // Clear VBlank flag
                this.writeToggle = false;
                return status;
            case 0x2007: // PPUDATA
                return this.data;
            default:
                return 0;
        }
    }
    
    writeRegister(addr, value) {
        switch (addr) {
            case 0x2000: // PPUCTRL
                this.ctrl = value;
                break;
            case 0x2001: // PPUMASK
                this.mask = value;
                break;
            case 0x2003: // OAMADDR
                this.oamAddr = value;
                break;
            case 0x2005: // PPUSCROLL
                if (!this.writeToggle) {
                    this.fineX = value & 0x07;
                    this.tempAddr = (this.tempAddr & 0x7FE0) | (value >> 3);
                } else {
                    this.tempAddr = (this.tempAddr & 0x0C1F) | ((value & 0x07) << 12) | ((value & 0xF8) << 2);
                }
                this.writeToggle = !this.writeToggle;
                break;
            case 0x2006: // PPUADDR
                if (!this.writeToggle) {
                    this.tempAddr = (this.tempAddr & 0x00FF) | ((value & 0x3F) << 8);
                } else {
                    this.tempAddr = (this.tempAddr & 0x7F00) | value;
                    this.vramAddr = this.tempAddr;
                }
                this.writeToggle = !this.writeToggle;
                break;
            case 0x2007: // PPUDATA
                this.data = value;
                this.vramAddr += (this.ctrl & 0x04) ? 32 : 1;
                break;
        }
    }
}

