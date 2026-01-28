#!/usr/bin/env python3
"""
Debug script to see what content is being collected for a specific lore
"""

import re

def load_source_data():
    """Load the source lore.md file"""
    with open('datasource/D20/lore.md', 'r', encoding='utf-8') as f:
        content = f.read()
    return content

def debug_lore_content():
    content = load_source_data()
    lines = content.split('\n')
    
    # Find "Lore of radiance" and see what content gets collected
    target_lore = "loreoF radiance"
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Check for @@Lore Name@@ or @@Lore Name## markers
        lore_match = re.match(r'^@@([^@#]+?)(?:##|@@)?$', line)
        if lore_match:
            lore_name = lore_match.group(1).strip()
            
            if lore_name == target_lore:
                print(f"Found target lore: {lore_name}")
                print("=" * 60)
                
                # Collect lore content until next @@ or ## or xx
                lore_content_lines = []
                i += 1
                line_count = 0
                
                while i < len(lines):
                    next_line = lines[i].strip()
                    line_count += 1
                    
                    print(f"Line {line_count}: {repr(next_line[:100])}")
                    
                    # Stop at next lore, house, or apocalyptic form
                    if (next_line.startswith('@@') or 
                        (next_line.startswith('##') and re.match(r'^##[A-Z][a-zA-Z]+', next_line)) or
                        next_line.startswith('xx') or
                        (next_line.startswith('TTT') and not next_line.endswith('TTT'))):
                        print(f"STOPPING at: {repr(next_line)}")
                        break
                    
                    lore_content_lines.append(lines[i])
                    i += 1
                    
                    # Don't stop early - collect all content
                    # if line_count >= 100:
                    #     print("... (stopping after 100 lines)")
                    #     break
                
                lore_content = '\n'.join(lore_content_lines)
                print(f"\nCollected {len(lore_content_lines)} lines")
                print(f"Content length: {len(lore_content)}")
                
                # Count evocation markers
                evocation_count = len(re.findall(r'^•+', lore_content, re.MULTILINE))
                print(f"Evocation markers found: {evocation_count}")
                
                return
        
        i += 1

if __name__ == "__main__":
    debug_lore_content()
