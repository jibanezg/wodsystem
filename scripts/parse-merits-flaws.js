/**
 * Merit/Flaw Parser
 * Extracts merit and flaw data from merits_and_flaws.md and generates JSON
 * 
 * Usage: node scripts/parse-merits-flaws.js
 */

const fs = require('fs');
const path = require('path');

// Read the source markdown file
const sourceFile = path.join(__dirname, '..', 'merits_and_flaws.md');
const content = fs.readFileSync(sourceFile, 'utf-8');
const lines = content.split('\n');

// Parse the master index from the end of the file (lines ~5843-6133)
function parseMasterIndex() {
    const index = { merits: [], flaws: [] };
    let inMerits = false;
    let inFlaws = false;
    
    for (let i = 5840; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === 'Merits' || line.includes('Merits')) {
            inMerits = true;
            inFlaws = false;
            continue;
        }
        
        if (line === 'Flaws' || line.includes('Flaws')) {
            inFlaws = true;
            inMerits = false;
            continue;
        }
        
        if (line.includes('Cost') || line.includes('Value') || line.includes('Type')) {
            continue;
        }
        
        if (!line || line.length < 3) continue;
        
        // Parse line format: "Name [Cost] Type"
        const match = line.match(/^(.+?)\s+([\d\s,torand\-]+)\s+(Physical|Mental|Social|Supernatural)$/i);
        
        if (match) {
            const entry = {
                name: match[1].trim(),
                cost: match[2].trim(),
                type: match[3].trim()
            };
            
            if (inMerits) {
                index.merits.push(entry);
            } else if (inFlaws) {
                index.flaws.push(entry);
            }
        }
    }
    
    return index;
}

// Extract description for a specific merit/flaw
function extractDescription(name, startLine, endLine) {
    let description = '';
    let gameEffects = '';
    let inDescription = false;
    
    for (let i = startLine; i <= endLine; i++) {
        const line = lines[i].trim();
        
        // Skip headers, page numbers, appendix markers
        if (line.includes('Appendix') || 
            line.match(/^\d+$/) || 
            line.includes('Odd Ends') ||
            line.includes('Chapter') ||
            line.includes('Book of Secrets')) {
            continue;
        }
        
        // Start capturing after finding the merit/flaw title
        if (line.includes(name) && line.includes('pt.') && line.includes('Merit|Flaw')) {
            inDescription = true;
            continue;
        }
        
        if (inDescription && line) {
            // Check for game effects keywords
            if (line.includes('game terms') || 
                line.includes('difficulty') || 
                line.includes('dice') || 
                line.includes('adds') || 
                line.includes('reduces')) {
                gameEffects += line + ' ';
            }
            description += line + ' ';
        }
    }
    
    return {
        description: description.trim().substring(0, 500), // Truncate for JSON
        gameEffects: gameEffects.trim().substring(0, 300)
    };
}

// Generate search terms from name
function generateSearchTerms(name) {
    const words = name.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
    return [...new Set(words)];
}

// Generate keywords from type and name
function generateKeywords(name, type) {
    const keywords = [type.toLowerCase()];
    const words = name.toLowerCase().split(/\s+/);
    keywords.push(...words.slice(0, 2));
    return keywords;
}

// Convert ID-friendly format
function toId(name) {
    return name.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
}

// Parse cost description
function parseCost(costStr) {
    const costs = [];
    const match = costStr.match(/\d+/g);
    if (match) {
        costs.push(...match.map(n => parseInt(n)));
    }
    return costs.length > 0 ? costs : [1];
}

// Main parser
function parseAll() {
    console.log('Parsing master index...');
    const index = parseMasterIndex();
    
    console.log(`Found ${index.merits.length} merits and ${index.flaws.length} flaws in index`);
    
    const output = {
        version: "1.0.0",
        source: "Mage: The Ascension 20th Anniversary Edition",
        lastUpdated: new Date().toISOString().split('T')[0],
        merits: [],
        flaws: []
    };
    
    // Process merits
    console.log('\nProcessing merits...');
    for (const merit of index.merits) {
        const costs = parseCost(merit.cost);
        
        output.merits.push({
            id: toId(merit.name),
            name: merit.name,
            type: merit.type,
            category: "Merit",
            cost: costs,
            costDescription: merit.cost,
            description: `[Extract description from source]`,
            gameEffects: `[Extract game effects from source]`,
            keywords: generateKeywords(merit.name, merit.type),
            searchTerms: generateSearchTerms(merit.name)
        });
    }
    
    // Process flaws
    console.log('Processing flaws...');
    for (const flaw of index.flaws) {
        const costs = parseCost(flaw.cost);
        
        output.flaws.push({
            id: toId(flaw.name),
            name: flaw.name,
            type: flaw.type,
            category: "Flaw",
            cost: costs,
            costDescription: flaw.cost,
            description: `[Extract description from source]`,
            gameEffects: `[Extract game effects from source]`,
            keywords: generateKeywords(flaw.name, flaw.type),
            searchTerms: generateSearchTerms(flaw.name)
        });
    }
    
    return output;
}

// Run parser
try {
    const result = parseAll();
    
    // Write to JSON file
    const outputPath = path.join(__dirname, '..', 'config', 'reference', 'merits_flaws.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    
    console.log(`\n✓ Successfully generated ${outputPath}`);
    console.log(`  - ${result.merits.length} merits`);
    console.log(`  - ${result.flaws.length} flaws`);
    console.log('\nNote: Descriptions are placeholders. You need to manually add the full text.');
    
} catch (error) {
    console.error('Error parsing file:', error);
    process.exit(1);
}

