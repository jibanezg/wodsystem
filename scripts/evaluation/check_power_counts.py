#!/usr/bin/env python3
import json

def check_power_counts():
    """Check power counts for all apocalyptic forms"""
    with open('datasource/D20/apocalyptic_forms.json', 'r') as f:
        data = json.load(f)
    
    print("🔍 APOCALYPTIC FORM POWER COUNTS")
    print("=" * 50)
    
    incorrect_forms = []
    
    for form in data['apocalypticForms']:
        power_count = len(form['powers'])
        name = form['name']
        house = form['house']
        
        if power_count != 8:
            incorrect_forms.append({
                'name': name,
                'house': house,
                'count': power_count,
                'powers': [p['name'] for p in form['powers']]
            })
            print(f"❌ {name} ({house}): {power_count} powers")
        else:
            print(f"✅ {name} ({house}): {power_count} powers")
    
    print(f"\n📊 SUMMARY:")
    print(f"Total forms: {len(data['apocalypticForms'])}")
    print(f"Forms with incorrect power count: {len(incorrect_forms)}")
    
    if incorrect_forms:
        print(f"\n🔧 DETAILED ISSUES:")
        for form in incorrect_forms:
            print(f"\n{form['name']} ({form['house']}): {form['count']} powers")
            for i, power in enumerate(form['powers'], 1):
                print(f"  {i}. {power}")

if __name__ == "__main__":
    check_power_counts()
