#!/usr/bin/env python3
"""
Debug script to see what the evaluation script is parsing for a specific lore
"""

import re
import json

def load_source_data():
    """Load the source lore.md file"""
    with open('datasource/D20/lore.md', 'r', encoding='utf-8') as f:
        content = f.read()
    return content

def parse_source_lores(content: str):
    """Parse source lores from lore.md (same as evaluation script)"""
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
            
        # Find the end of this lore section (next @@ or end of content)
        start_pos = match.end()
        end_pos = lore_matches[i + 1].start() if i + 1 < len(lore_matches) else len(relevant_content)
        lore_content = relevant_content[start_pos:end_pos].strip()
        
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

def debug_eval_parsing():
    content = load_source_data()
    lores = parse_source_lores(content)
    
    target_lore = "Lore of radiance"
    
    if target_lore in lores:
        lore_data = lores[target_lore]
        print(f"Found: {target_lore}")
        print(f"Content length: {len(lore_data['content'])}")
        print(f"Evocations found: {len(lore_data['evocations'])}")
        
        print("\nEvocations:")
        for i, evocation in enumerate(lore_data['evocations']):
            print(f"  {i+1}. Level {evocation['level']}: {evocation['name']}")
        
        print(f"\nFirst 500 chars of content:")
        print(repr(lore_data['content'][:500]))
        
        print(f"\nLast 500 chars of content:")
        print(repr(lore_data['content'][-500:]))
    else:
        print(f"NOT FOUND: {target_lore}")
        print("Available lores:")
        for name in sorted(lores.keys()):
            if 'radiance' in name.lower():
                print(f"  - {name}")

if __name__ == "__main__":
    debug_eval_parsing()
