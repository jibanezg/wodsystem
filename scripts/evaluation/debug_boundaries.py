#!/usr/bin/env python3
import re

def debug_boundaries():
    """Debug what's causing boundary detection to trigger for Bel"""
    with open('datasource/D20/lore.md', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find Bel's section
    bel_start = content.find('xxBel, the visaGeoF the celestials')
    if bel_start == -1:
        print("Bel section not found!")
        return
    
    # Extract Bel's section using the same logic as the extraction script
    sections = re.split(r'\nxx', content)
    bel_section = None
    
    for section in sections:
        if 'Bel, the visaGeoF the celestials' in section:
            bel_section = section
            break
    
    if not bel_section:
        print("Bel section not found in split sections!")
        return
    
    lines = bel_section.strip().split('\n')
    
    print("🔍 BEL'S SECTION BOUNDARY DEBUG:")
    print("=" * 50)
    
    # Simulate the extraction logic to find where it stops
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Check the boundary conditions
        stops_at = []
        if line.startswith('xx@@##'):
            stops_at.append("xx@@##")
        if line.startswith('xx@@'):
            stops_at.append("xx@@")
        if line.startswith('@@') and 'lore' in line.lower() and 'visage' not in line.lower() and 'confers' not in line.lower():
            stops_at.append("@@ lore transition")
        
        if stops_at:
            print(f"\n🛑 STOPPING at line {i+1}: {line}")
            print(f"   Triggers: {stops_at}")
            print(f"   Previous lines processed: {i}")
            break
        
        # Check for power lines
        if line.startswith('•'):
            print(f"⚡ Line {i+1}: {line}")
        
        # Show first 30 lines regardless
        if i < 30:
            print(f"{i+1:2}: {line}")

if __name__ == "__main__":
    debug_boundaries()
