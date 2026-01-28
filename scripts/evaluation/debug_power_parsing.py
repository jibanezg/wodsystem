#!/usr/bin/env python3
import re

def normalize_ocr_text(text: str) -> str:
    """Normalize OCR variations consistently"""
    if not text:
        return text
    
    text = re.sub(r'visaGeoF', 'the Visage of', text, flags=re.IGNORECASE)
    text = re.sub(r'viSage', 'the Visage of', text, flags=re.IGNORECASE)
    text = re.sub(r'the\s+the\s+Visage\s+of', 'the Visage of', text, flags=re.IGNORECASE)
    text = re.sub(r'of\s+of+', 'of', text)
    text = re.sub(r'the\s+the+', 'the', text)
    text = re.sub(r'\bthe Visage of\b', 'the Visage of', text)
    return text

def debug_power_parsing():
    """Debug the power parsing logic step by step"""
    with open('datasource/D20/lore.md', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find Bel's section
    sections = re.split(r'\nxx', content)
    bel_section = None
    
    for section in sections:
        if 'Bel, the visaGeoF the celestials' in section:
            bel_section = section
            break
    
    if not bel_section:
        print("Bel section not found!")
        return
    
    lines = bel_section.strip().split('\n')
    
    print("🔍 BEL'S POWER PARSING STEP-BY-STEP:")
    print("=" * 50)
    
    # Parse abilities using the exact same logic as the extraction script
    low_torment_powers = []
    high_torment_powers = []
    current_section = None
    
    for i, line in enumerate(lines):
        original_line = line
        line = line.strip()
        
        # Check boundary conditions first
        if line.startswith('xx@@##') or line.startswith('xx@@') or (line.startswith('@@') and 'lore' in line.lower() and 'visage' not in line.lower() and 'confers' not in line.lower()):
            print(f"\n🛑 BOUNDARY: {original_line}")
            break
        
        # Check for high torment section
        if 'high-Torment abilities' in line.lower() or 'high-torment abilities' in line.lower():
            current_section = 'high'
            print(f"\n🔥 SWITCHED TO HIGH TORMENT: {original_line}")
            continue
        
        # Check for power lines
        if line.startswith('•'):
            print(f"\n⚡ FOUND POWER LINE {i+1}: {original_line}")
            
            # Extract power name
            if ':' in line:
                power_name = line.split(':', 1)[0].strip()
                power_desc = line.split(':', 1)[1].strip()
            else:
                power_name = line.strip()
                power_desc = ""
            
            print(f"   Raw name: '{power_name}'")
            print(f"   Description: '{power_desc[:50]}...'")
            
            # Normalize power name
            normalized_power_name = normalize_ocr_text(power_name)
            print(f"   After OCR normalize: '{normalized_power_name}'")
            
            # Fix specific evocation name patterns
            normalized_power_name = re.sub(r'([A-Z]+)OF\s+([A-Z]+)', r'\1 of \2', normalized_power_name)
            normalized_power_name = re.sub(r'([A-Z]+)OF([A-Z]+)', r'\1 of \2', normalized_power_name)
            normalized_power_name = re.sub(r'([A-Z]+)THE\s+([A-Z]+)', r'\1 the \2', normalized_power_name)
            normalized_power_name = re.sub(r'([A-Z]+)THE([A-Z]+)', r'\1 the \2', normalized_power_name)
            # Fix weird capitalization patterns
            normalized_power_name = re.sub(r'([a-z])([A-Z])([a-z])', r'\1\2\3', normalized_power_name)
            # Fix specific known patterns (preserve bullet points)
            bullets = ''
            if normalized_power_name.startswith('•'):
                bullets = '•' * (len(normalized_power_name) - len(normalized_power_name.lstrip('•')))
                normalized_power_name = normalized_power_name.lstrip('•').strip()
            # Apply fixes
            normalized_power_name = normalized_power_name.replace('liGht', 'Light')
            normalized_power_name = normalized_power_name.replace('maniPulate', 'Manipulate') 
            normalized_power_name = normalized_power_name.replace('shaPe', 'Shape')
            # Capitalize first letter only
            normalized_power_name = bullets + normalized_power_name.capitalize()
            
            print(f"   Final normalized: '{normalized_power_name}'")
            print(f"   Section: {current_section}")
            
            power_data = {
                'name': normalized_power_name,
                'description': power_desc,
                'isHighTorment': current_section == 'high'
            }
            
            if current_section == 'high':
                high_torment_powers.append(power_data)
                print(f"   ✅ ADDED TO HIGH TORMENT")
            else:
                low_torment_powers.append(power_data)
                print(f"   ✅ ADDED TO LOW TORMENT")
    
    print(f"\n📊 FINAL RESULTS:")
    print(f"Low Torment Powers: {len(low_torment_powers)}")
    for power in low_torment_powers:
        print(f"  - {power['name']}")
    
    print(f"\nHigh Torment Powers: {len(high_torment_powers)}")
    for power in high_torment_powers:
        print(f"  - {power['name']}")
    
    print(f"\n🎯 TOTAL: {len(low_torment_powers) + len(high_torment_powers)} powers")

if __name__ == "__main__":
    debug_power_parsing()
