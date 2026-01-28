#!/usr/bin/env python3
import json

data = json.load(open('datasource/D20/apocalyptic_forms.json'))
for form in data['apocalypticForms']:
    print(f"'{form['name']}'")
