#!/usr/bin/env python3
"""
Analyze the 4 missing evocations to identify exactly what's missing
"""

import re

def load_source_data():
    """Load the source lore.md file"""
    with open('datasource/D20/lore.md', 'r', encoding='utf-8') as f:
        content = f.read()
    return content

def load_extracted_data():
    """Load the extracted lore.json file"""
    import json
    with open('datasource/D20/lore.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def parse_source_lores(content: str):
    """Parse source lores from lore.md"""
    lores = {}
    
    # Skip the comment section at the beginning
    content_start = content.find('TTTCommon lore')
    if content_start == -1:
        content_start = content.find('@@Lore of the Fundament')
    if content_start == -1:
        content_start = 0
    
    relevant_content = content[content_start:]
    
    # Find all lore sections using @@ marker across all house sections
    lore_pattern = r'@@([^\n]+)'
    lore_matches = list(re.finditer(lore_pattern, relevant_content))
    
    for i, match in enumerate(lore_matches):
        lore_name = match.group(1).strip()
        
        # Clean up the lore name (remove ## markers and extra spaces)
        lore_name = lore_name.replace('##', '').strip()
        
        # Normalize the name for better comparison
        normalized_name = lore_name.lower().replace(' ', '').replace('loreof', 'lore of')
        
        # Skip if it's not actually a lore (like empty or ## markers)
        if not lore_name or lore_name == '##' or 'lore' not in normalized_name:
            continue
        
        # Fix common OCR issues
        if 'loreof' in lore_name.lower():
            lore_name = lore_name.lower().replace('loreof', 'Lore of')
        if 'lof' in lore_name.lower():
            lore_name = lore_name.lower().replace('lof', 'Lore of')
            
        # Find the end of this lore section by processing line by line like the extraction script
        start_pos = match.end()
        
        # Process lines to find the correct boundary
        lines = relevant_content[start_pos:].split('\n')
        lore_content_lines = []
        
        for line in lines:
            line_stripped = line.strip()
            
            # Stop at next lore, house, or apocalyptic form (same logic as extraction script)
            if (line_stripped.startswith('@@') or 
                (line_stripped.startswith('##') and re.match(r'^##[A-Z][a-zA-Z]+', line_stripped)) or
                line_stripped.startswith('xx') or
                (line_stripped.startswith('TTT') and not line_stripped.endswith('TTT'))):
                break
            
            lore_content_lines.append(line)
        
        lore_content = '\n'.join(lore_content_lines).strip()
        
        lores[lore_name] = {
            'name': lore_name,
            'content': lore_content,
            'evocations': parse_source_evocations(lore_content)
        }
    
    return lores

def parse_source_evocations(lore_content: str):
    """Parse evocations from lore content using bullet point format"""
    evocations = []
    
    # Find evocation sections using bullet points (•, ••, •••, etc.)
    evocation_pattern = r'(•+)\s*([^\n]+?)(?=\n|$)'
    evocation_matches = list(re.finditer(evocation_pattern, lore_content, re.MULTILINE))
    
    for match in evocation_matches:
        bullets = match.group(1)  # •, ••, •••, etc.
        evocation_name = match.group(2).strip()
        level = len(bullets)  # Count bullets to determine level
        
        evocations.append({
            'level': level,
            'name': evocation_name,
        })
    
    return evocations

def analyze_missing_evocations():
    content = load_source_data()
    extracted_data = load_extracted_data()
    
    # Parse source lores
    source_lores = parse_source_lores(content)
    
    # Get extracted lores
    extracted_lores = {lore['name']: lore for lore in extracted_data['lorePaths']}
    
    print("=" * 80)
    print("🔍 ANALYSIS OF MISSING EVOCATIONS")
    print("=" * 80)
    
    total_missing = 0
    
    for lore_name in sorted(source_lores.keys()):
        source_lore = source_lores[lore_name]
        
        # Find corresponding extracted lore
        extracted_lore = None
        for extracted_name, extracted_data in extracted_lores.items():
            if extracted_name.lower() == lore_name.lower():
                extracted_lore = extracted_data
                break
        
        if not extracted_lore:
            print(f"\n❌ {lore_name}: NOT FOUND IN EXTRACTED DATA")
            continue
        
        source_evs = source_lore['evocations']
        extracted_evs = extracted_lore['evocations']
        
        if len(source_evs) != len(extracted_evs):
            missing_count = len(source_evs) - len(extracted_evs)
            total_missing += missing_count
            
            print(f"\n📚 {lore_name}")
            print(f"   Source: {len(source_evs)} evocations")
            print(f"   Extracted: {len(extracted_evs)} evocations")
            print(f"   ❌ Missing: {missing_count} evocations")
            
            # Show source evocations
            print(f"   📋 Source evocations:")
            for i, ev in enumerate(source_evs):
                status = "✅" if i < len(extracted_evs) else "❌"
                print(f"      {status} Level {ev['level']}: {ev['name']}")
            
            # Show extracted evocations
            print(f"   📋 Extracted evocations:")
            for i, ev in enumerate(extracted_evs):
                print(f"      ✅ Level {ev['level']}: {ev['name']}")
    
    print(f"\n" + "=" * 80)
    print(f"📊 SUMMARY: {total_missing} evocations missing total")
    print("=" * 80)

if __name__ == "__main__":
    analyze_missing_evocations()
