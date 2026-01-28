#!/usr/bin/env python3
"""
Debug script to see what's actually in the source for apocalyptic forms
"""

import re

def load_source_data():
    """Load the source lore.md file"""
    with open('datasource/D20/lore.md', 'r', encoding='utf-8') as f:
        content = f.read()
    return content

def debug_apocalyptic_source():
    content = load_source_data()
    
    # Find a specific form to analyze
    target_form = "Zaltu, the visaGeoF the Beast"
    
    # Find the form section
    form_pattern = rf'xx{re.escape(target_form)}\s*\n(.*?)(?=\nxx|\n##|\Z)'
    form_match = re.search(form_pattern, content, re.DOTALL | re.MULTILINE)
    
    if form_match:
        form_content = form_match.group(1)
        print(f"Found: {target_form}")
        print("=" * 80)
        print("Full content:")
        print(repr(form_content[:1000]))
        print("\n" + "=" * 80)
        print("Content with line numbers:")
        
        lines = form_content.split('\n')
        for i, line in enumerate(lines[:50]):  # Show first 50 lines
            line_num = i + 1
            if line.startswith('•'):
                print(f"POWER {line_num}: {repr(line)}")
            elif 'highTorment' in line.lower() or 'high-torment' in line.lower():
                print(f"HIGH {line_num}: {repr(line)}")
            elif 'special capabilities' in line.lower():
                print(f"LOW  {line_num}: {repr(line)}")
            else:
                print(f"     {line_num}: {repr(line)}")
        
        # Count all bullet points
        all_bullets = re.findall(r'^•.*$', form_content, re.MULTILINE)
        print(f"\nTotal bullet points found: {len(all_bullets)}")
        for i, bullet in enumerate(all_bullets):
            print(f"  {i+1}: {repr(bullet)}")
    else:
        print(f"Form not found: {target_form}")

if __name__ == "__main__":
    debug_apocalyptic_source()
