#!/usr/bin/env python3
import json

def find_ocr_issues():
    """Find evocation names with OCR issues"""
    with open('datasource/D20/apocalyptic_forms.json', 'r') as f:
        data = json.load(f)
    
    issues = []
    patterns = [
        'OF',  # SPHEREOF, voiceoF, auraoF, markoF, mouthoF
        'THE',  # touchFrom, Placesat
        'AND',  # commandand
        'TO',  # similar
    ]
    
    for form in data['apocalypticForms']:
        for power in form['powers']:
            name = power['name']
            # Look for concatenated words with capital letters
            if any(pattern in name.upper() and pattern not in name for pattern in patterns):
                issues.append({
                    'form': form['name'],
                    'power': name,
                    'issue': 'Concatenated words'
                })
            
            # Look for weird capitalization
            if any(c.isupper() for c in name[1:]) and name[0] != '•':
                issues.append({
                    'form': form['name'], 
                    'power': name,
                    'issue': 'Weird capitalization'
                })
    
    print("Found OCR issues in evocation names:")
    for issue in issues:
        print(f"- {issue['form']}: '{issue['power']}' ({issue['issue']})")

if __name__ == "__main__":
    find_ocr_issues()
