#!/usr/bin/env python3
"""
Comprehensive evaluation of apocalyptic forms extraction from lore.md
"""

import re
import json
from typing import Dict, List, Set

def load_source_data():
    """Load the source lore.md file"""
    with open('datasource/D20/lore.md', 'r', encoding='utf-8') as f:
        content = f.read()
    return content

def load_extracted_data():
    """Load the extracted apocalyptic_forms.json file"""
    with open('datasource/D20/apocalyptic_forms.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def parse_source_apocalyptic_forms(content: str) -> Dict[str, Dict]:
    """Parse apocalyptic forms from lore.md"""
    forms = {}
    
    # Find all apocalyptic form sections using xx marker
    form_pattern = r'^xx([^\n]+)'
    form_matches = list(re.finditer(form_pattern, content, re.MULTILINE))
    
    for match in form_matches:
        form_name = match.group(1).strip()
        
        # Skip format instruction lines
        if ('indicate' in form_name.lower() or 
            'wildcard' in form_name.lower() or
            'will indicate' in form_name.lower()):
            continue
        
        # Find the end of this form section (next xx, ##, or end)
        start_pos = match.end()
        
        # Process lines to find the correct boundary
        lines = content[start_pos:].split('\n')
        form_content_lines = []
        
        for line in lines:
            line_stripped = line.strip()
            
            # Stop at next form, house, or section marker
            if (line_stripped.startswith('xx') or 
                (line_stripped.startswith('##') and re.match(r'^##[A-Z][a-zA-Z]+', line_stripped)) or
                line_stripped.startswith('TTT') and not line_stripped.endswith('TTT')):
                break
            
            form_content_lines.append(line)
        
        form_content = '\n'.join(form_content_lines).strip()
        
        forms[form_name] = {
            'name': form_name,
            'content': form_content,
            'powers': parse_form_powers(form_content)
        }
    
    return forms

def parse_form_powers(form_content: str) -> List[Dict]:
    """Parse powers from apocalyptic form content"""
    powers = []
    
    # Find power sections using bullet points (•, ••, etc.)
    power_pattern = r'(•+)\s*([^\n]+?)(?=\n|$)'
    power_matches = list(re.finditer(power_pattern, form_content, re.MULTILINE))
    
    for match in power_matches:
        bullets = match.group(1)
        power_name = match.group(2).strip()
        is_high_torment = bullets.count('•') > 1  # Multiple bullets = high torment
        
        # Extract description (everything after the name until next bullet or end)
        desc_start = match.end()
        remaining_content = form_content[desc_start:]
        
        # Find the next bullet point or end of section
        next_bullet_match = re.search(r'\n•', remaining_content)
        if next_bullet_match:
            description = remaining_content[:next_bullet_match.start()].strip()
        else:
            description = remaining_content.strip()
        
        # Clean up description
        description = re.sub(r'\n+', ' ', description).strip()
        
        powers.append({
            'name': power_name,
            'description': description,
            'isHighTorment': is_high_torment
        })
    
    return powers

def normalize_name(name: str) -> str:
    """Normalize name for comparison"""
    return re.sub(r'[^a-zA-Z0-9\s]', '', name.lower()).strip()

def evaluate_apocalyptic_extraction():
    print("=" * 80)
    print("🔍 APOCALYPTIC FORMS EXTRACTION EVALUATION")
    print("=" * 80)
    
    # Load data
    source_content = load_source_data()
    extracted_data = load_extracted_data()
    
    # Parse source
    source_forms = parse_source_apocalyptic_forms(source_content)
    
    # Get extracted forms
    extracted_forms = {form['name']: form for form in extracted_data['apocalypticForms']}
    
    print(f"\n📊 OVERVIEW:")
    print(f"Source forms found: {len(source_forms)}")
    print(f"Extracted forms: {len(extracted_forms)}")
    
    # Metrics
    metrics = {
        'missing_forms': [],
        'extra_forms': [],
        'form_accuracy': {},
        'power_completeness': {},
        'id_issues': [],
        'house_issues': [],
        'lore_linking_issues': []
    }
    
    # Check for missing forms
    for source_name, source_form in source_forms.items():
        normalized_source = normalize_name(source_name)
        
        # Find matching extracted form
        found = False
        for extracted_name, extracted_form in extracted_forms.items():
            if normalize_name(extracted_name) == normalized_source:
                found = True
                
                # Compare details
                issues = []
                
                # Check powers
                source_powers = source_form['powers']
                extracted_powers = extracted_form['powers']
                
                if len(source_powers) != len(extracted_powers):
                    issues.append(f"Power count mismatch: {len(source_powers)} vs {len(extracted_powers)}")
                
                # Check power names
                source_power_names = {normalize_name(p['name']) for p in source_powers}
                extracted_power_names = {normalize_name(p['name']) for p in extracted_powers}
                
                missing_powers = source_power_names - extracted_power_names
                extra_powers = extracted_power_names - source_power_names
                
                if missing_powers:
                    issues.append(f"Missing powers: {list(missing_powers)}")
                if extra_powers:
                    issues.append(f"Extra powers: {list(extra_powers)}")
                
                # Check ID format
                expected_id = re.sub(r'[^a-zA-Z0-9]', '_', source_name.lower())
                if extracted_form['id'] != expected_id:
                    issues.append(f"ID mismatch: expected '{expected_id}', got '{extracted_form['id']}'")
                
                # Check house assignment
                if 'house' not in extracted_form or extracted_form['house'] == 'Unknown':
                    issues.append("House not assigned or Unknown")
                
                # Check associated lore
                if not extracted_form.get('associatedLore'):
                    issues.append("No associated lore linked")
                
                metrics['form_accuracy'][source_name] = issues
                break
        
        if not found:
            metrics['missing_forms'].append(source_name)
    
    # Check for extra forms
    extracted_normalized = {normalize_name(name): name for name in extracted_forms.keys()}
    source_normalized = {normalize_name(name): name for name in source_forms.keys()}
    
    for norm_name, extracted_name in extracted_normalized.items():
        if norm_name not in source_normalized:
            metrics['extra_forms'].append(extracted_name)
    
    # Detailed analysis
    print(f"\n🔍 DETAILED ANALYSIS:")
    
    for form_name, issues in metrics['form_accuracy'].items():
        print(f"\n📚 {form_name}")
        if issues:
            for issue in issues:
                print(f"   ❌ {issue}")
        else:
            print(f"   ✅ No issues found")
    
    # Summary report
    print(f"\n" + "=" * 80)
    print(f"📋 SUMMARY REPORT")
    print(f"=" * 80)
    
    print(f"\n📈 COMPLETENESS:")
    print(f"Missing forms: {len(metrics['missing_forms'])}")
    for form in metrics['missing_forms']:
        print(f"  - {form}")
    
    print(f"Extra forms: {len(metrics['extra_forms'])}")
    for form in metrics['extra_forms']:
        print(f"  - {form}")
    
    print(f"\n🎯 ACCURACY:")
    total_issues = sum(len(issues) for issues in metrics['form_accuracy'].values())
    print(f"Total accuracy issues: {total_issues}")
    
    if total_issues == 0 and len(metrics['missing_forms']) == 0 and len(metrics['extra_forms']) == 0:
        print("✅ EXTRACTION QUALITY: PERFECT (100%)")
    elif total_issues <= 5:
        print("✅ EXTRACTION QUALITY: GOOD (90%+)")
    else:
        print("❌ EXTRACTION QUALITY: NEEDS IMPROVEMENT")
    
    print(f"\nTotal issues found: {total_issues + len(metrics['missing_forms']) + len(metrics['extra_forms'])}")

if __name__ == "__main__":
    evaluate_apocalyptic_extraction()
