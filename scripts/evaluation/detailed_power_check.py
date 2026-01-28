#!/usr/bin/env python3
import json

def detailed_power_check():
    """Detailed check of all power counts"""
    with open('datasource/D20/apocalyptic_forms.json', 'r') as f:
        data = json.load(f)
    
    print("🔍 DETAILED POWER COUNT ANALYSIS:")
    print("=" * 60)
    
    total_forms = len(data['apocalypticForms'])
    correct_count = 0
    incorrect_count = 0
    
    for i, form in enumerate(data['apocalypticForms'], 1):
        power_count = len(form['powers'])
        low_count = len([p for p in form['powers'] if not p['isHighTorment']])
        high_count = len([p for p in form['powers'] if p['isHighTorment']])
        
        status = "✅" if power_count == 8 else "❌"
        print(f"{i:2}. {status} {form['name'][:40]:40} ({form['house']:8}): {power_count:2} total ({low_count} low, {high_count} high)")
        
        if power_count == 8:
            correct_count += 1
        else:
            incorrect_count += 1
            print(f"     POWERS:")
            for j, power in enumerate(form['powers'], 1):
                print(f"       {j}. {power['name']}")
    
    print(f"\n📊 SUMMARY:")
    print(f"Total forms: {total_forms}")
    print(f"Correct (8 powers): {correct_count}")
    print(f"Incorrect (!=8 powers): {incorrect_count}")
    print(f"Accuracy: {correct_count/total_forms*100:.1f}%")

if __name__ == "__main__":
    detailed_power_check()
