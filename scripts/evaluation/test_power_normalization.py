#!/usr/bin/env python3
import re

def normalize_ocr_text(text: str) -> str:
    """Normalize OCR variations consistently"""
    if not text:
        return text
    
    # Handle specific OCR patterns more carefully
    # Pattern 1: "visaGeoF" → "the Visage of"
    text = re.sub(r'visaGeoF', 'the Visage of', text, flags=re.IGNORECASE)
    
    # Pattern 2: "viSage" → "the Visage of"  
    text = re.sub(r'viSage', 'the Visage of', text, flags=re.IGNORECASE)
    
    # Pattern 3: "the visaGeoF" → "the Visage of" (avoid duplication)
    text = re.sub(r'the\s+the\s+Visage\s+of', 'the Visage of', text, flags=re.IGNORECASE)
    
    # Pattern 4: "the viSage" → "the Visage of" (avoid duplication)
    text = re.sub(r'the\s+the\s+Visage\s+of', 'the Visage of', text, flags=re.IGNORECASE)
    
    # Clean up multiple "of"s
    text = re.sub(r'of\s+of+', 'of', text)
    
    # Clean up multiple "the"s
    text = re.sub(r'the\s+the+', 'the', text)
    
    # Capitalize properly
    text = re.sub(r'\bthe Visage of\b', 'the Visage of', text)
    
    return text

def normalize_power_name(power_name):
    """Test power name normalization"""
    # Normalize OCR variations in power names
    normalized_power_name = normalize_ocr_text(power_name)
    # Fix specific evocation name patterns - handle both with and without spaces
    normalized_power_name = re.sub(r'([A-Z]+)OF\s+([A-Z]+)', r'\1 of \2', normalized_power_name)
    normalized_power_name = re.sub(r'([A-Z]+)OF([A-Z]+)', r'\1 of \2', normalized_power_name)
    normalized_power_name = re.sub(r'([A-Z]+)THE\s+([A-Z]+)', r'\1 the \2', normalized_power_name)
    normalized_power_name = re.sub(r'([A-Z]+)THE([A-Z]+)', r'\1 the \2', normalized_power_name)
    # Fix weird capitalization patterns - be more selective
    normalized_power_name = re.sub(r'([a-z])([A-Z])([a-z])', r'\1\2\3', normalized_power_name).title()
    # Fix specific known patterns
    normalized_power_name = normalized_power_name.replace('li Ght', 'Light')
    normalized_power_name = normalized_power_name.replace('mani Pulate', 'Manipulate') 
    normalized_power_name = normalized_power_name.replace('sha Pe', 'Shape')
    
    return normalized_power_name

# Test the problematic names
test_names = [
    "•SPHEREOF CHAOS",
    "••WAVEOF MUTILATION", 
    "•••SUMMON OUTSIDER",
    "•LASHOF CORRUPTION",
    "••VISIONOF TERROR",
    "liGht",
    "maniPulate",
    "shaPe"
]

for name in test_names:
    normalized = normalize_power_name(name)
    print(f"'{name}' → '{normalized}'")
