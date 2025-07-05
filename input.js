export class Input {
    constructor() {
        this.controller1 = {
            a: false,
            b: false,
            select: false,
            start: false,
            up: false,
            down: false,
            left: false,
            right: false,
            index: 0,
            strobe: false
        };
        
        this.controller2 = {
            a: false,
            b: false,
            select: false,
            start: false,
            up: false,
            down: false,
            left: false,
            right: false,
            index: 0,
            strobe: false
        };
        
        this.keyMap = {
            'KeyX': 'a',
            'KeyZ': 'b',
            'ShiftLeft': 'select',
            'ShiftRight': 'select',
            'Enter': 'start',
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        
        this.initializeControls();
    }
    
    initializeControls() {
        document.addEventListener('keydown', (e) => {
            const button = this.keyMap[e.code];
            if (button) {
                e.preventDefault();
                this.controller1[button] = true;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            const button = this.keyMap[e.code];
            if (button) {
                e.preventDefault();
                this.controller1[button] = false;
            }
        });
    }
    
    readController1() {
        if (this.controller1.strobe) {
            return this.controller1.a ? 1 : 0;
        }
        
        const buttons = [
            this.controller1.a,
            this.controller1.b,
            this.controller1.select,
            this.controller1.start,
            this.controller1.up,
            this.controller1.down,
            this.controller1.left,
            this.controller1.right
        ];
        
        const result = buttons[this.controller1.index] ? 1 : 0;
        this.controller1.index = (this.controller1.index + 1) % 8;
        return result;
    }
    
    readController2() {
        if (this.controller2.strobe) {
            return this.controller2.a ? 1 : 0;
        }
        
        const buttons = [
            this.controller2.a,
            this.controller2.b,
            this.controller2.select,
            this.controller2.start,
            this.controller2.up,
            this.controller2.down,
            this.controller2.left,
            this.controller2.right
        ];
        
        const result = buttons[this.controller2.index] ? 1 : 0;
        this.controller2.index = (this.controller2.index + 1) % 8;
        return result;
    }
    
    writeController(value) {
        this.controller1.strobe = (value & 1) !== 0;
        this.controller2.strobe = (value & 1) !== 0;
        
        if (this.controller1.strobe) {
            this.controller1.index = 0;
            this.controller2.index = 0;
        }
    }
}

