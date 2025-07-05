export class Memory {
    constructor() {
        this.ram = new Uint8Array(0x800);     // 2KB internal RAM
        this.prgRom = null;                    // Program ROM
        this.chrRom = null;                    // Character ROM
        this.sram = new Uint8Array(0x2000);   // Save RAM
        this.mapper = 0;                       // Memory mapper
        this.mirroring = 0;                    // Mirroring mode
    }
    
    loadROM(romData, header) {
        const headerSize = 16;
        const trainerSize = header.trainer ? 512 : 0;
        
        let offset = headerSize + trainerSize;
        
        // Load PRG ROM
        this.prgRom = new Uint8Array(header.prgRomSize);
        for (let i = 0; i < header.prgRomSize; i++) {
            this.prgRom[i] = romData[offset + i];
        }
        offset += header.prgRomSize;
        
        // Load CHR ROM
        if (header.chrRomSize > 0) {
            this.chrRom = new Uint8Array(header.chrRomSize);
            for (let i = 0; i < header.chrRomSize; i++) {
                this.chrRom[i] = romData[offset + i];
            }
        }
        
        this.mapper = header.mapper;
        this.mirroring = header.mirroring;
    }
    
    read(addr) {
        addr &= 0xFFFF;
        
        if (addr < 0x2000) {
            // Internal RAM (mirrored)
            return this.ram[addr & 0x7FF];
        } else if (addr < 0x4000) {
            // PPU registers (mirrored)
            return window.nes?.ppu?.readRegister(addr & 0x2007) || 0;
        } else if (addr < 0x4020) {
            // APU and I/O registers
            if (addr === 0x4016) {
                return window.nes?.input?.readController1() || 0;
            } else if (addr === 0x4017) {
                return window.nes?.input?.readController2() || 0;
            }
            return window.nes?.apu?.readRegister(addr) || 0;
        } else if (addr < 0x6000) {
            // Expansion ROM
            return 0;
        } else if (addr < 0x8000) {
            // SRAM
            return this.sram[addr - 0x6000];
        } else {
            // PRG ROM
            if (this.prgRom) {
                if (this.prgRom.length === 0x4000) {
                    // 16KB ROM, mirror in both halves
                    return this.prgRom[addr & 0x3FFF];
                } else {
                    // 32KB ROM
                    return this.prgRom[addr - 0x8000];
                }
            }
            return 0;
        }
    }
    
    write(addr, value) {
        addr &= 0xFFFF;
        value &= 0xFF;
        
        if (addr < 0x2000) {
            // Internal RAM (mirrored)
            this.ram[addr & 0x7FF] = value;
        } else if (addr < 0x4000) {
            // PPU registers (mirrored)
            window.nes?.ppu?.writeRegister(addr & 0x2007, value);
        } else if (addr < 0x4020) {
            // APU and I/O registers
            if (addr === 0x4016) {
                window.nes?.input?.writeController(value);
            } else {
                window.nes?.apu?.writeRegister(addr, value);
            }
        } else if (addr < 0x6000) {
            // Expansion ROM
        } else if (addr < 0x8000) {
            // SRAM
            this.sram[addr - 0x6000] = value;
        }
        // PRG ROM is read-only
    }
    
    read16(addr) {
        const low = this.read(addr);
        const high = this.read(addr + 1);
        return low | (high << 8);
    }
    
    write16(addr, value) {
        this.write(addr, value & 0xFF);
        this.write(addr + 1, (value >> 8) & 0xFF);
    }
}

