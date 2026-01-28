#!/usr/bin/env python3
import json

def debug_bel_extraction():
    """Debug what's actually extracted for Bel"""
    with open('datasource/D20/apocalyptic_forms.json', 'r') as f:
        data = json.load(f)
    
    # Find Bel
    bel = None
    for form in data['apocalypticForms']:
        if 'Bel' in form['name']:
            bel = form
            break
    
    if not bel:
        print("Bel not found in extracted data!")
        return
    
    print("🔍 BEL'S EXTRACTED DATA:")
    print("=" * 50)
    print(f"Name: {bel['name']}")
    print(f"House: {bel['house']}")
    print(f"Power Count: {len(bel['powers'])}")
    
    print(f"\n⚡ EXTRACTED POWERS:")
    for i, power in enumerate(bel['powers'], 1):
        print(f"{i}. {power['name']} (High Torment: {power['isHighTorment']})")
    
    # Check what we expect vs what we got
    expected_low = ['Wings', 'Lordly Mien', 'Enhanced Senses', 'Increased Awareness']
    expected_high = ['Claws/Teeth', 'Scales', 'Increased Size', 'Dread Gaze']
    
    extracted_low = [p['name'] for p in bel['powers'] if not p['isHighTorment']]
    extracted_high = [p['name'] for p in bel['powers'] if p['isHighTorment']]
    
    print(f"\n📊 COMPARISON:")
    print(f"Expected Low (4): {expected_low}")
    print(f"Extracted Low ({len(extracted_low)}): {extracted_low}")
    
    print(f"\nExpected High (4): {expected_high}")
    print(f"Extracted High ({len(extracted_high)}): {extracted_high}")
    
    missing_low = set(expected_low) - set(extracted_low)
    missing_high = set(expected_high) - set(extracted_high)
    
    if missing_low:
        print(f"\n❌ Missing Low Powers: {missing_low}")
    if missing_high:
        print(f"\n❌ Missing High Powers: {missing_high}")

if __name__ == "__main__":
    debug_bel_extraction()
