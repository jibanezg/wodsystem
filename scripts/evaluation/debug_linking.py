#!/usr/bin/env python3
import json

def normalize_name(name: str) -> str:
    """Normalize name for comparison"""
    import re
    return re.sub(r'[^a-zA-Z0-9\s]', '', name.lower()).strip()

# Load data
with open('datasource/D20/apocalyptic_forms.json', 'r') as f:
    apocalyptic_data = json.load(f)

# Create mapping
apocalyptic_mapping = {}
for form in apocalyptic_data['apocalypticForms']:
    apocalyptic_mapping[form['name'].lower()] = form['id']
    apocalyptic_mapping[normalize_name(form['name'])] = form['id']

# Test some lookups
test_names = [
    'ishhara, the Visage of lonGinG',
    'adad, the Visage of storms',
    'mammetum, the Visage of transFiGuration',
    'Zaltu, the Visage of the Beast'
]

print("Testing apocalyptic_mapping lookups:")
for name in test_names:
    print(f"'{name}' -> {apocalyptic_mapping.get(name.lower(), 'NOT FOUND')}")
    print(f"Normalized: '{normalize_name(name)}' -> {apocalyptic_mapping.get(normalize_name(name), 'NOT FOUND')}")
    print()
