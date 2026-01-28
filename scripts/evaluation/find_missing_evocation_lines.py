#!/usr/bin/env python3
"""
Find the exact line numbers where the 4 missing evocations are located
"""

import re

def load_source_data():
    """Load the source lore.md file"""
    with open('datasource/D20/lore.md', 'r', encoding='utf-8') as f:
        content = f.read()
    return content

def find_missing_evocation_lines():
    content = load_source_data()
    lines = content.split('\n')
    
    # Find "Lore of violation" section
    target_lore = "LOREOF VIOLATION"
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Check for @@Lore Name@@ or @@Lore Name## markers
        lore_match = re.match(r'^@@([^@#]+?)(?:##|@@)?$', line)
        if lore_match:
            lore_name = lore_match.group(1).strip()
            
            if lore_name == target_lore:
                print(f"Found target lore: {lore_name}")
                print("=" * 80)
                
                # Show context around the missing evocations
                start_context = max(0, i - 2)
                end_context = min(len(lines), i + 50)  # Show 50 lines after
                
                in_missing_section = False
                missing_patterns = [
                    "A point of temporary Faith",
                    "A point of temporary Willpower", 
                    "A temporary Ability increase",
                    "A particular memory or linked set"
                ]
                
                for j in range(start_context, end_context):
                    line_num = j + 1
                    line_content = lines[j]
                    
                    # Check if this line contains one of the missing evocations
                    is_missing = any(pattern in line_content for pattern in missing_patterns)
                    
                    if is_missing:
                        in_missing_section = True
                    
                    if j == i:
                        print(f">>> {line_num}: {repr(line_content)}")
                    elif is_missing or in_missing_section:
                        print(f"!!! {line_num}: {repr(line_content)}")
                        # Stop the missing section after we hit a non-missing line
                        if in_missing_section and not is_missing and line_content.strip() and not line_content.startswith('•'):
                            in_missing_section = False
                    elif line_content.startswith('•') or line_content.startswith('xx') or line_content.startswith('##'):
                        print(f"### {line_num}: {repr(line_content)}")
                
                return
        
        i += 1

if __name__ == "__main__":
    find_missing_evocation_lines()
