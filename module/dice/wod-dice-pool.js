/**
 * World of Darkness 20th Anniversary Edition Dice Pool
 * Handles rolling and calculating results for WoD dice pools
 */
export class WodDicePool {
    constructor(poolSize, difficulty = 6, options = {}) {
        this.poolSize = Math.max(1, poolSize);
        this.difficulty = Math.max(2, Math.min(10, difficulty));
        this.specialty = options.specialty || false;
        this.automatic = options.automatic || false;
        this.modifiers = options.modifiers || [];
    }
    
    /**
     * Roll the dice pool and calculate results
     * @returns {Object} Roll results including successes, botch status, and individual die results
     */
    async roll() {
        // Apply modifiers to pool size
        let finalPool = this.poolSize;
        this.modifiers.forEach(mod => {
            finalPool += mod.value;
        });
        finalPool = Math.max(1, finalPool); // Minimum 1 die
        
        // Roll Nd10
        const roll = new Roll(`${finalPool}d10`);
        await roll.evaluate();
        
        // Process results
        const results = [];
        let successes = 0;
        let ones = 0;
        
        roll.dice[0].results.forEach(r => {
            const value = r.result;
            let dieClass = 'failure';
            
            if (value === 1) {
                ones++;
                successes--;
                dieClass = 'one';
            } else if (value >= this.difficulty) {
                if (this.specialty && value === 10) {
                    successes += 2; // Specialty: 10s count as 2
                    dieClass = 'specialty';
                } else {
                    successes++;
                    dieClass = 'success';
                }
            }
            
            results.push({ value, class: dieClass });
        });
        
        const isBotch = (successes <= 0 && ones > 0);
        const isSuccess = successes > 0;
        
        return {
            roll,
            successes: Math.max(0, successes),
            ones,
            isBotch,
            isSuccess,
            results,
            finalPool,
            difficulty: this.difficulty
        };
    }
}

