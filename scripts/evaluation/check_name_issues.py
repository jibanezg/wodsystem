#!/usr/bin/env python3
import json

def check_name_issues():
    """Check the specific name accuracy issues"""
    with open('datasource/D20/lore.json', 'r') as f:
        lore_data = json.load(f)
    
    # Check Lore of radiance
    radiance = lore_data['lores'].get('Lore of radiance', {})
    if 'evocations' in radiance:
        level_1 = [e for e in radiance['evocations'] if e.get('level') == 1]
        if level_1:
            print(f"Lore of radiance Level 1: '{level_1[0]['name']}'")
    
    # Check Lore of the spirit  
    spirit = lore_data['lores'].get('Lore of the spirit', {})
    if 'evocations' in spirit:
        level_1 = [e for e in spirit['evocations'] if e.get('level') == 1]
        if level_1:
            print(f"Lore of the spirit Level 1: '{level_1[0]['name']}'")

if __name__ == "__main__":
    check_name_issues()
