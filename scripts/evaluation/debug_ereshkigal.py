#!/usr/bin/env python3

# Test the house detection logic
def determine_house(visage_name):
    """Determine the house based on the visage name"""
    house_mapping = {
        'Bel': 'Devil',
        'Qingu': 'Devil', 
        'Zaltu': 'Devourer',
        'Adad': 'Defiler',
        'Anshar': 'Defiler',
        'Antu': 'Malefactor',
        'Aruru': 'Malefactor',
        'Dagan': 'Malefactor',
        'Ellil': 'Fiend',
        'Ishhara': 'Devil',
        'Kishar': 'Malefactor',
        'Mammetum': 'Devil',
        'Mummu': 'Malefactor',
        'Namtar': 'Devil',
        'Nedu': 'Devil',
        'Nergal': 'Fiend',
        'Ninsun': 'Devil',
        'Ninurtu': 'Devourer',
        'Nusku': 'Fiend',
        'Shamash': 'Devil',
        'Ereshkigal': 'Devil'
    }
    
    # Extract the base name (before "the visaGeoF" or "visaGeoF")
    print(f"Original name: '{visage_name}'")
    
    if 'the visaGeoF' in visage_name:
        base_name = visage_name.split('the visaGeoF')[0].strip()
        # Remove any comma and space
        base_name = base_name.replace(',', '').strip()
        print(f"Base name (the visaGeoF): '{base_name}'")
        return house_mapping.get(base_name, 'Unknown')
    elif 'visaGeoF' in visage_name:
        base_name = visage_name.split('visaGeoF')[0].strip()
        # Remove any comma and space
        base_name = base_name.replace(',', '').strip()
        print(f"Base name (visaGeoF): '{base_name}'")
        return house_mapping.get(base_name, 'Unknown')
    elif 'the viSage' in visage_name:
        base_name = visage_name.split('the viSage')[0].strip()
        # Remove any comma and space
        base_name = base_name.replace(',', '').strip()
        print(f"Base name (the viSage): '{base_name}'")
        return house_mapping.get(base_name, 'Unknown')
    elif 'viSage' in visage_name:
        base_name = visage_name.split('viSage')[0].strip()
        # Remove any comma and space
        base_name = base_name.replace(',', '').strip()
        print(f"Base name (viSage): '{base_name}'")
        return house_mapping.get(base_name, 'Unknown')
    
    print("No pattern matched")
    return 'Unknown'

# Test with Ereshkigal's actual name
test_name = "ereshkiGal, the Visage of the realms"
result = determine_house(test_name)
print(f"Result: {result}")

# Test with the normalized name
test_name2 = "ereshkiGal, visaGeoF the realms"
result2 = determine_house(test_name2)
print(f"Result 2: {result2}")
