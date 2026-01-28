#!/usr/bin/env python3
import re

def normalize_ocr_text(text: str) -> str:
    """Normalize OCR variations consistently"""
    if not text:
        return text
    
    # Handle specific OCR patterns more carefully
    text = re.sub(r'visaGeoF', 'the Visage of', text, flags=re.IGNORECASE)
    text = re.sub(r'viSage', 'the Visage of', text, flags=re.IGNORECASE)
    text = re.sub(r'the\s+the\s+Visage\s+of', 'the Visage of', text, flags=re.IGNORECASE)
    text = re.sub(r'of\s+of+', 'of', text)
    text = re.sub(r'the\s+the+', 'the', text)
    text = re.sub(r'\bthe Visage of\b', 'the Visage of', text)
    return text

def debug_bel_parsing():
    """Debug Bel's power parsing"""
    with open('datasource/D20/lore.md', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find and extract Bel's section
    bel_start = content.find('xxBel, the visaGeoF the celestials')
    if bel_start == -1:
        print("Bel section not found!")
        return
    
    # Find the end of Bel's section
    next_xx = content.find('\nxx', bel_start + 1)
    if next_xx == -1:
        next_xx = len(content)
    
    bel_section = content[bel_start:next_xx]
    lines = bel_section.strip().split('\n')
    
    print("🔍 BEL'S POWER PARSING DEBUG:")
    print("=" * 50)
    
    # Extract visage name and description
    first_line = lines[0]
    visage_name = first_line.replace('xx', '').strip()
    print(f"Visage Name: '{visage_name}'")
    
    # Parse abilities using the same logic as the extraction script
    low_torment_powers = []
    high_torment_powers = []
    current_section = None
    
    print(f"\n📋 PARSING {len(lines)} LINES:")
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Skip empty lines
        if not line:
            continue
            
        print(f"{i+1:2}: {line}")
        
        # Check for high torment section
        if 'high-Torment abilities' in line.lower() or 'high-torment abilities' in line.lower():
            current_section = 'high'
            print(f"    >>> SWITCHED TO HIGH TORMENT SECTION")
            continue
        
        # Check for power lines
        if line.startswith('•'):
            # Extract power name
            if ':' in line:
                power_name = line.split(':', 1)[0].strip()
                power_desc = line.split(':', 1)[1].strip()
            else:
                power_name = line.strip()
                power_desc = ""
            
            # Normalize power name
            normalized_name = normalize_ocr_text(power_name)
            # Fix specific evocation name patterns
            normalized_name = re.sub(r'([A-Z]+)OF\s+([A-Z]+)', r'\1 of \2', normalized_name)
            normalized_name = re.sub(r'([A-Z]+)OF([A-Z]+)', r'\1 of \2', normalized_name)
            normalized_name = re.sub(r'([A-Z]+)THE\s+([A-Z]+)', r'\1 the \2', normalized_name)
            normalized_name = re.sub(r'([A-Z]+)THE([A-Z]+)', r'\1 the \2', normalized_name)
            # Fix weird capitalization patterns
            normalized_name = re.sub(r'([a-z])([A-Z])([a-z])', r'\1\2\3', normalized_name)
            # Fix specific known patterns (preserve bullet points)
            bullets = ''
            if normalized_name.startswith('•'):
                bullets = '•' * (len(normalized_name) - len(normalized_name.lstrip('•')))
                normalized_name = normalized_name.lstrip('•').strip()
            # Apply fixes
            normalized_name = normalized_name.replace('liGht', 'Light')
            normalized_name = normalized_name.replace('maniPulate', 'Manipulate') 
            normalized_name = normalized_name.replace('shaPe', 'Shape')
            # Capitalize first letter only
            normalized_name = bullets + normalized_name.capitalize()
            
            power_data = {
                'name': normalized_name,
                'description': power_desc,
                'isHighTorment': current_section == 'high'
            }
            
            if current_section == 'high':
                high_torment_powers.append(power_data)
                print(f"    >>> HIGH TORMENT POWER: '{normalized_name}'")
            else:
                low_torment_powers.append(power_data)
                print(f"    >>> LOW TORMENT POWER: '{normalized_name}'")
    
    print(f"\n📊 RESULTS:")
    print(f"Low Torment Powers: {len(low_torment_powers)}")
    for power in low_torment_powers:
        print(f"  - {power['name']}")
    
    print(f"\nHigh Torment Powers: {len(high_torment_powers)}")
    for power in high_torment_powers:
        print(f"  - {power['name']}")
    
    print(f"\n🎯 TOTAL: {len(low_torment_powers) + len(high_torment_powers)} powers")

if __name__ == "__main__":
    debug_bel_parsing()
