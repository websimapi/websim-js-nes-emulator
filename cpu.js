export class CPU {
    constructor(memory) {
        this.memory = memory;
        this.reset();
    }
    
    reset() {
        this.a = 0;      // Accumulator
        this.x = 0;      // X register
        this.y = 0;      // Y register
        this.sp = 0xFD;  // Stack pointer
        this.pc = 0;     // Program counter
        this.p = 0x24;   // Status register
        
        // Read reset vector
        this.pc = this.memory.read16(0xFFFC);
        
        this.cycles = 0;
    }
    
    step() {
        const opcode = this.memory.read(this.pc);
        this.pc++;
        
        const instruction = this.instructions[opcode];
        if (!instruction) {
            console.warn(`Unknown opcode: 0x${opcode.toString(16)}`);
            return 1;
        }
        
        const cycles = instruction.call(this);
        this.cycles += cycles;
        return cycles;
    }
    
    // Status register flags
    get flagN() { return (this.p & 0x80) !== 0; }
    get flagV() { return (this.p & 0x40) !== 0; }
    get flagB() { return (this.p & 0x10) !== 0; }
    get flagD() { return (this.p & 0x08) !== 0; }
    get flagI() { return (this.p & 0x04) !== 0; }
    get flagZ() { return (this.p & 0x02) !== 0; }
    get flagC() { return (this.p & 0x01) !== 0; }
    
    set flagN(val) { this.p = val ? (this.p | 0x80) : (this.p & 0x7F); }
    set flagV(val) { this.p = val ? (this.p | 0x40) : (this.p & 0xBF); }
    set flagB(val) { this.p = val ? (this.p | 0x10) : (this.p & 0xEF); }
    set flagD(val) { this.p = val ? (this.p | 0x08) : (this.p & 0xF7); }
    set flagI(val) { this.p = val ? (this.p | 0x04) : (this.p & 0xFB); }
    set flagZ(val) { this.p = val ? (this.p | 0x02) : (this.p & 0xFD); }
    set flagC(val) { this.p = val ? (this.p | 0x01) : (this.p & 0xFE); }
    
    setZN(value) {
        this.flagZ = (value & 0xFF) === 0;
        this.flagN = (value & 0x80) !== 0;
    }
    
    push(value) {
        this.memory.write(0x0100 + this.sp, value);
        this.sp = (this.sp - 1) & 0xFF;
    }
    
    pull() {
        this.sp = (this.sp + 1) & 0xFF;
        return this.memory.read(0x0100 + this.sp);
    }
    
    nmi() {
        this.push((this.pc >> 8) & 0xFF);
        this.push(this.pc & 0xFF);
        this.push(this.p);
        this.flagI = true;
        this.pc = this.memory.read16(0xFFFA);
    }
    
    irq() {
        if (!this.flagI) {
            this.push((this.pc >> 8) & 0xFF);
            this.push(this.pc & 0xFF);
            this.push(this.p);
            this.flagI = true;
            this.pc = this.memory.read16(0xFFFE);
        }
    }
    
    // Addressing modes
    immediate() { return this.pc++; }
    zeroPage() { return this.memory.read(this.pc++); }
    zeroPageX() { return (this.memory.read(this.pc++) + this.x) & 0xFF; }
    zeroPageY() { return (this.memory.read(this.pc++) + this.y) & 0xFF; }
    absolute() { return this.memory.read16(this.pc); this.pc += 2; }
    absoluteX() { const addr = this.memory.read16(this.pc); this.pc += 2; return (addr + this.x) & 0xFFFF; }
    absoluteY() { const addr = this.memory.read16(this.pc); this.pc += 2; return (addr + this.y) & 0xFFFF; }
    indirect() { const addr = this.memory.read16(this.pc); this.pc += 2; return this.memory.read16(addr); }
    indirectX() { const addr = (this.memory.read(this.pc++) + this.x) & 0xFF; return this.memory.read16(addr); }
    indirectY() { const addr = this.memory.read(this.pc++); return (this.memory.read16(addr) + this.y) & 0xFFFF; }
    
    // Instructions (basic implementation)
    instructions = {
        // LDA
        0xA9: () => { this.a = this.memory.read(this.immediate()); this.setZN(this.a); return 2; },
        0xA5: () => { this.a = this.memory.read(this.zeroPage()); this.setZN(this.a); return 3; },
        0xB5: () => { this.a = this.memory.read(this.zeroPageX()); this.setZN(this.a); return 4; },
        0xAD: () => { this.a = this.memory.read(this.absolute()); this.setZN(this.a); return 4; },
        0xBD: () => { this.a = this.memory.read(this.absoluteX()); this.setZN(this.a); return 4; },
        0xB9: () => { this.a = this.memory.read(this.absoluteY()); this.setZN(this.a); return 4; },
        0xA1: () => { this.a = this.memory.read(this.indirectX()); this.setZN(this.a); return 6; },
        0xB1: () => { this.a = this.memory.read(this.indirectY()); this.setZN(this.a); return 5; },
        
        // STA
        0x85: () => { this.memory.write(this.zeroPage(), this.a); return 3; },
        0x95: () => { this.memory.write(this.zeroPageX(), this.a); return 4; },
        0x8D: () => { this.memory.write(this.absolute(), this.a); return 4; },
        0x9D: () => { this.memory.write(this.absoluteX(), this.a); return 5; },
        0x99: () => { this.memory.write(this.absoluteY(), this.a); return 5; },
        0x81: () => { this.memory.write(this.indirectX(), this.a); return 6; },
        0x91: () => { this.memory.write(this.indirectY(), this.a); return 6; },
        
        // JMP
        0x4C: () => { this.pc = this.absolute(); return 3; },
        0x6C: () => { this.pc = this.indirect(); return 5; },
        
        // NOP
        0xEA: () => { return 2; },
        
        // Basic operations for demo
        0x00: () => { return 7; } // BRK
    };
}

