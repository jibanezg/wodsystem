#!/usr/bin/env python3
import json

def find_large_power_arrays():
    """Find any apocalyptic forms with more than 8 powers"""
    with open('datasource/D20/apocalyptic_forms.json', 'r') as f:
        data = json.load(f)
    
    print("🔍 CHECKING FOR FORMS WITH >8 POWERS:")
    print("=" * 50)
    
    found_issues = False
    
    for form in data['apocalypticForms']:
        power_count = len(form['powers'])
        if power_count != 8:
            found_issues = True
            print(f"❌ {form['name']} ({form['house']}): {power_count} powers")
            
            # Show the powers
            for i, power in enumerate(form['powers'], 1):
                print(f"  {i}. {power['name']} (High: {power['isHighTorment']})")
            print()
    
    if not found_issues:
        print("✅ All forms have exactly 8 powers!")
    
    # Also check total form count
    print(f"\n📊 Total forms: {len(data['apocalypticForms'])}")

if __name__ == "__main__":
    find_large_power_arrays()
