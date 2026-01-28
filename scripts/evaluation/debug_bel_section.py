#!/usr/bin/env python3
import re

def debug_bel_section():
    """Debug Bel's apocalyptic form section"""
    with open('datasource/D20/lore.md', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find Bel's section
    bel_start = content.find('xxBel, the visaGeoF the celestials')
    if bel_start == -1:
        print("Bel section not found!")
        return
    
    # Extract a large chunk around Bel's section
    start = max(0, bel_start - 100)
    end = min(len(content), bel_start + 2000)
    chunk = content[start:end]
    
    print("🔍 BEL'S SECTION DEBUG:")
    print("=" * 50)
    
    # Show how sections are split
    sections = re.split(r'\nxx', chunk)
    for i, section in enumerate(sections):
        if 'Bel, the visaGeoF the celestials' in section:
            print(f"\n📋 SECTION {i} (Bel's section):")
            lines = section.strip().split('\n')[:20]  # First 20 lines
            for j, line in enumerate(lines):
                print(f"{j+1:2}: {line}")
            if len(section.strip().split('\n')) > 20:
                print(f"... ({len(section.strip().split('\n')) - 20} more lines)")
            
            # Check for power patterns
            power_lines = [line for line in section.strip().split('\n') if line.strip().startswith('•')]
            print(f"\n⚡ POWER LINES FOUND: {len(power_lines)}")
            for power in power_lines:
                print(f"  - {power.strip()}")

if __name__ == "__main__":
    debug_bel_section()
