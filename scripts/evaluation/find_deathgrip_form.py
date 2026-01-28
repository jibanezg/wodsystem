#!/usr/bin/env python3
import json

def find_deathgrip_form():
    """Find which form contains Deathgrip power"""
    with open('datasource/D20/apocalyptic_forms.json', 'r') as f:
        data = json.load(f)
    
    for form in data['apocalypticForms']:
        for power in form['powers']:
            if 'Deathgrip' in power['name']:
                print(f"Form: {form['name']}")
                print(f"House: {form['house']}")
                print(f"Total Powers: {len(form['powers'])}")
                print(f"Power: {power['name']} (High: {power['isHighTorment']})")
                return

if __name__ == "__main__":
    find_deathgrip_form()
