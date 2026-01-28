#!/usr/bin/env python3
import json

# Load data
with open('datasource/D20/apocalyptic_forms.json', 'r') as f:
    apocalyptic_data = json.load(f)

# Create mapping
apocalyptic_mapping = {}
for form in apocalyptic_data['apocalypticForms']:
    apocalyptic_mapping[form['name']] = form['id']

# Test the exact names from the JSON
test_names = [
    'ishhara, the Visage of lonGinG',
    'adad, the Visage of storms',
    'mammetum, the Visage of transFiGuration',
    'Zaltu, the Visage of the Beast'
]

print("Testing exact JSON names:")
for name in test_names:
    if name in apocalyptic_mapping:
        print(f"✅ '{name}' -> {apocalyptic_mapping[name]}")
    else:
        print(f"❌ '{name}' -> NOT FOUND")
        # Find similar names
        for key in apocalyptic_mapping.keys():
            if 'lonGinG' in key and 'ishhara' in key:
                print(f"   Similar: '{key}'")
                break
