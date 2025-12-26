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
        // Apply modifiers by type
        let finalPool = this.poolSize;
        let finalDifficulty = this.difficulty;
        let autoSuccesses = 0;
        let autoFails = 0;
        
        this.modifiers.forEach(mod => {
            const modType = mod.type || 'poolBonus'; // Default to pool bonus for backward compatibility
            
            switch(modType) {
                case 'poolBonus':
                    finalPool += mod.value;
                    break;
                case 'difficultyMod':
                    finalDifficulty += mod.value;
                    break;
                case 'autoSuccess':
                    autoSuccesses += mod.value;
                    break;
                case 'autoFail':
                    autoFails += mod.value;
                    break;
                default:
                    // Legacy support: treat as pool bonus
                    finalPool += mod.value;
            }
        });
        
        // Clamp values
        finalPool = Math.max(1, finalPool); // Minimum 1 die
        finalDifficulty = Math.max(2, Math.min(10, finalDifficulty)); // Difficulty 2-10
        
        // Roll Nd10
        const roll = new Roll(`${finalPool}d10`);
        await roll.evaluate();
        
        // Process results
        const results = [];
        let successes = autoSuccesses; // Start with auto successes
        let ones = autoFails; // Start with auto fails
        
        roll.dice[0].results.forEach(r => {
            const value = r.result;
            let dieClass = 'failure';
            
            if (value === 1) {
                ones++;
                successes--;
                dieClass = 'one';
            } else if (value >= finalDifficulty) {
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
            difficulty: finalDifficulty,
            autoSuccesses,
            autoFails
        };
    }
}

