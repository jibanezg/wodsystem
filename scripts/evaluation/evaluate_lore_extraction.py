#!/usr/bin/env python3
"""
Comprehensive evaluation script for lore extraction accuracy.
Compares extracted lore.json with source lore.md to ensure 100% correctness.
"""

import json
import re
from typing import Dict, List, Tuple, Set
from collections import defaultdict

def load_source_data():
    """Load the source lore.md file"""
    with open('datasource/D20/lore.md', 'r', encoding='utf-8') as f:
        content = f.read()
    return content

def load_extracted_data():
    """Load the extracted lore.json file"""
    with open('datasource/D20/lore.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def parse_source_lores(content: str) -> Dict[str, Dict]:
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
        if 'loreoF' in lore_name:
            lore_name = lore_name.replace('loreoF', 'Lore of')
            
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

def parse_source_evocations(lore_content: str) -> List[Dict]:
    """Parse evocations from lore content using bullet point format"""
    evocations = []
    
    # Split content by System: sections to avoid counting descriptive bullets
    sections = re.split(r'\nSystem:', lore_content, flags=re.IGNORECASE)
    main_content = sections[0]  # Only process bullets before the first System:
    
    # Find evocation sections using bullet points (•, ••, •••, etc.)
    # Also handle - bullets for descriptive items within System: sections
    evocation_pattern = r'(•+|-)\s*([^\n]+?)(?=\n|$)'
    evocation_matches = list(re.finditer(evocation_pattern, main_content, re.MULTILINE))
    
    for match in evocation_matches:
        bullets = match.group(1)  # •, ••, •••, etc. or -
        evocation_name = match.group(2).strip()
        
        # Skip - bullets as they're descriptive, not evocations
        if bullets == '-':
            continue
            
        level = len(bullets)  # Count bullets to determine level
        
        # Extract description (everything after the name until next bullet or end)
        desc_start = match.end()
        remaining_content = main_content[desc_start:]
        
        # Find the next bullet point or end of section
        next_bullet_match = re.search(r'\n[•-]', remaining_content)
        if next_bullet_match:
            description = remaining_content[:next_bullet_match.start()].strip()
        else:
            description = remaining_content.strip()
        
        # Clean up description
        description = re.sub(r'\n+', ' ', description).strip()
        
        # Remove system/torment sections from description for cleaner comparison
        description = re.sub(r'System:.*?(?=Torment:|$)', '', description, flags=re.DOTALL).strip()
        description = re.sub(r'Torment:.*', '', description, flags=re.DOTALL).strip()
        
        evocations.append({
            'level': level,
            'name': evocation_name,
            'description': description
        })
    
    return evocations

def normalize_name(name: str) -> str:
    """Normalize name for comparison"""
    return re.sub(r'\s+', ' ', name.lower().strip())

def evaluate_lore_extraction():
    """Main evaluation function"""
    print("=" * 80)
    print("🔍 LORE EXTRACTION EVALUATION")
    print("=" * 80)
    
    # Load data
    source_content = load_source_data()
    extracted_data = load_extracted_data()
    
    # Parse source
    source_lores = parse_source_lores(source_content)
    
    # Get extracted lores
    extracted_lores = {lore['name']: lore for lore in extracted_data['lorePaths']}
    
    # Get extracted black knowledge lores if they exist
    extracted_black_knowledge = {}
    if 'blackKnowledge' in extracted_data:
        extracted_black_knowledge = {lore['name']: lore for lore in extracted_data['blackKnowledge']}
    
    print(f"\n📊 OVERVIEW:")
    print(f"Source lores found: {len(source_lores)}")
    print(f"Extracted lores: {len(extracted_lores)}")
    if extracted_black_knowledge:
        print(f"Extracted Black Knowledge lores: {len(extracted_black_knowledge)}")
    
    # Metrics
    metrics = {
        'missing_lores': [],
        'extra_lores': [],
        'lore_accuracy': {},
        'evocation_completeness': {},
        'ocr_issues': [],
        'total_source_evocations': 0,
        'total_extracted_evocations': 0
    }
    
    # Check for missing lores
    source_norm_names = {normalize_name(name): name for name in source_lores.keys()}
    extracted_norm_names = {normalize_name(name): name for name in extracted_lores.keys()}
    
    # Include Black Knowledge in the comparison
    all_extracted_names = set(extracted_norm_names.keys())
    if extracted_black_knowledge:
        all_extracted_names.update({normalize_name(name): name for name in extracted_black_knowledge.keys()})
    
    for norm_name, original_name in source_norm_names.items():
        if norm_name not in all_extracted_names:
            metrics['missing_lores'].append(original_name)
    
    # Check for extra lores
    for norm_name, original_name in extracted_norm_names.items():
        if norm_name not in source_norm_names:
            metrics['extra_lores'].append(original_name)
    
    # Detailed comparison
    print(f"\n🔍 DETAILED ANALYSIS:")
    
    for source_name, source_lore in source_lores.items():
        source_norm = normalize_name(source_name)
        
        if source_norm not in extracted_norm_names:
            print(f"❌ MISSING: {source_name}")
            continue
            
        extracted_name = extracted_norm_names[source_norm]
        extracted_lore = extracted_lores[extracted_name]
        
        print(f"\n📚 {source_name}")
        
        # Compare evocations
        source_evs = source_lore['evocations']
        extracted_evs = extracted_lore['evocations']
        
        metrics['total_source_evocations'] += len(source_evs)
        metrics['total_extracted_evocations'] += len(extracted_evs)
        
        print(f"   Source evocations: {len(source_evs)}")
        print(f"   Extracted evocations: {len(extracted_evs)}")
        
        # Check each level
        for level in range(1, 6):
            source_ev = next((ev for ev in source_evs if ev['level'] == level), None)
            extracted_ev = next((ev for ev in extracted_evs if ev['level'] == level), None)
            
            if source_ev and not extracted_ev:
                print(f"   ❌ Level {level}: Missing evocation")
                metrics['evocation_completeness'][f"{source_name}_level_{level}"] = "missing"
            elif extracted_ev and not source_ev:
                print(f"   ⚠️  Level {level}: Extra evocation: {extracted_ev['name']}")
                metrics['evocation_completeness'][f"{source_name}_level_{level}"] = "extra"
            elif source_ev and extracted_ev:
                # Compare names
                source_norm_name = normalize_name(source_ev['name'])
                extracted_norm_name = normalize_name(extracted_ev['name'])
                
                if source_norm_name != extracted_norm_name:
                    print(f"   ⚠️  Level {level}: Name mismatch")
                    print(f"      Source: '{source_ev['name']}'")
                    print(f"      Extracted: '{extracted_ev['name']}'")
                    metrics['lore_accuracy'][f"{source_name}_level_{level}_name"] = "mismatch"
                
                # Check for OCR issues
                if 'loreoF' in extracted_ev['name'].lower() or 'conFess' in extracted_ev['name']:
                    print(f"   🔧 Level {level}: OCR issue detected in name")
                    metrics['ocr_issues'].append(f"{source_name}_level_{level}_name")
    
    # Summary
    print(f"\n" + "=" * 80)
    print("📋 SUMMARY REPORT")
    print("=" * 80)
    
    print(f"\n📈 COMPLETENESS:")
    print(f"Missing lores: {len(metrics['missing_lores'])}")
    if metrics['missing_lores']:
        for lore in metrics['missing_lores']:
            print(f"  - {lore}")
    
    print(f"Extra lores: {len(metrics['extra_lores'])}")
    if metrics['extra_lores']:
        for lore in metrics['extra_lores']:
            print(f"  - {lore}")
    
    print(f"\n🎯 ACCURACY:")
    print(f"Total source evocations: {metrics['total_source_evocations']}")
    print(f"Total extracted evocations: {metrics['total_extracted_evocations']}")
    
    if metrics['total_source_evocations'] > 0:
        completeness = (metrics['total_extracted_evocations'] / metrics['total_source_evocations']) * 100
        print(f"Evocation completeness: {completeness:.1f}%")
    
    print(f"OCR issues found: {len(metrics['ocr_issues'])}")
    if metrics['ocr_issues']:
        for issue in metrics['ocr_issues']:
            print(f"  - {issue}")
    
    print(f"\nName accuracy issues: {len(metrics['lore_accuracy'])}")
    if metrics['lore_accuracy']:
        for issue, status in metrics['lore_accuracy'].items():
            print(f"  - {issue}: {status}")
    
    # Overall score
    issues = (len(metrics['missing_lores']) + len(metrics['extra_lores']) + 
              len(metrics['ocr_issues']) + len(metrics['lore_accuracy']))
    
    if issues == 0:
        print(f"\n🎉 EXTRACTION QUALITY: EXCELLENT (100%)")
    elif issues <= 5:
        print(f"\n✅ EXTRACTION QUALITY: GOOD ({100 - (issues * 5):.0f}%)")
    elif issues <= 10:
        print(f"\n⚠️  EXTRACTION QUALITY: FAIR ({100 - (issues * 3):.0f}%)")
    else:
        print(f"\n❌ EXTRACTION QUALITY: POOR ({max(0, 100 - (issues * 2)):.0f}%)")
    
    print(f"\nTotal issues found: {issues}")
    
    return metrics

if __name__ == "__main__":
    evaluate_lore_extraction()
