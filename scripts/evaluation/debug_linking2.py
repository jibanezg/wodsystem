#!/usr/bin/env python3
import json

# Load data
with open('datasource/D20/apocalyptic_forms.json', 'r') as f:
    apocalyptic_data = json.load(f)

# Show all names
print("All apocalyptic form names:")
for i, form in enumerate(apocalyptic_data['apocalypticForms']):
    print(f"{i+1}: '{form['name']}'")
    print(f"   ID: '{form['id']}'")
    print()
