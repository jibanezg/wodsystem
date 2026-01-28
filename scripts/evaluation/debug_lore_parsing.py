#!/usr/bin/env python3
"""
Debug script to understand the lore.md structure
"""

import re

def load_source_data():
    """Load the source lore.md file"""
    with open('datasource/D20/lore.md', 'r', encoding='utf-8') as f:
        content = f.read()
    return content

def debug_lore_parsing():
    content = load_source_data()
    
    # Skip the comment section at the beginning
    content_start = content.find('TTTCommon lore')
    if content_start == -1:
        content_start = content.find('@@Lore of the Fundament')
    if content_start == -1:
        content_start = 0
    
    relevant_content = content[content_start:]
    
    print(f"Content starts at position: {content_start}")
    print(f"Relevant content length: {len(relevant_content)}")
    
    print("\nLooking for @@ patterns in relevant content...")
    
    # Find all lore sections using @@ marker (but not in comments)
    lore_pattern = r'^@@([A-Za-z\s]+?)(?=^@@|^##|^TTT|\Z)'
    lore_matches = list(re.finditer(lore_pattern, relevant_content, re.MULTILINE | re.MULTILINE))
    
    print(f"Found {len(lore_matches)} matches")
    
    for i, match in enumerate(lore_matches[:5]):  # Show first 5
        print(f"\nMatch {i+1}:")
        print(f"  Full match: {repr(match.group(0)[:100])}")
        print(f"  Lore name: {repr(match.group(1))}")
        print(f"  Position: {match.start()}-{match.end()}")
    
    # Let's also try a simpler pattern on the relevant content
    print("\n" + "="*50)
    print("Trying simpler pattern on relevant content...")
    
    simple_pattern = r'@@([^\n]+)'
    simple_matches = list(re.finditer(simple_pattern, relevant_content))
    
    print(f"Simple pattern found {len(simple_matches)} matches")
    
    for i, match in enumerate(simple_matches):
        print(f"  {i+1}: {repr(match.group(1))}")
    
    # Let's see some sample content around the first @@ in relevant content
    print("\n" + "="*50)
    print("Sample content around first @@ in relevant content...")
    
    first_at = relevant_content.find('@@')
    if first_at != -1:
        start = max(0, first_at - 50)
        end = min(len(relevant_content), first_at + 200)
        sample = relevant_content[start:end]
        print(repr(sample))

if __name__ == "__main__":
    debug_lore_parsing()
