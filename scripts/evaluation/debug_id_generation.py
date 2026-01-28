#!/usr/bin/env python3
import re

# Test the ID generation logic
test_names = [
    "ereshkiGal, visaGeoF the realms",
    "Bel, the visaGeoF the celestials", 
    "Qingu, the Visage of radianCe"
]

for name in test_names:
    print(f"Original: '{name}'")
    
    # Current logic
    id_base = name.lower()
    print(f"Lower: '{id_base}'")
    
    id_base = re.sub(r' the visaGeoF ', ' the visage of ', id_base)
    print(f"After the visaGeoF: '{id_base}'")
    
    id_base = re.sub(r' visaGeoF ', ' visage of ', id_base)
    print(f"After visaGeoF: '{id_base}'")
    
    id_base = re.sub(r' the viSage ', ' the visage of ', id_base)
    print(f"After the viSage: '{id_base}'")
    
    id_base = re.sub(r' viSage ', ' visage of ', id_base)
    print(f"After viSage: '{id_base}'")
    
    form_id = id_base.replace(' ', '_').replace(',', '').replace('.', '')
    print(f"Final ID: '{form_id}'")
    print("---")
