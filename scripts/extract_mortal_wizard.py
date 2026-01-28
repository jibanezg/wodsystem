#!/usr/bin/env python3
"""
Script to extract MortalWizard base class from WodCharacterWizard
Removes all creature-specific logic (spheres, lore, enlightenment, Demon/Mage/Technocrat/Spirit specific code)
"""

import re
import sys

def should_remove_line(line):
    """Check if a line should be removed (creature-specific logic)"""
    line_lower = line.lower()
    
    # Remove lines with creature-specific checks
    creature_checks = [
        'if.*actortype.*===.*"technocrat"',
        'if.*actortype.*===.*"mage"',
        'if.*actortype.*===.*"demon"',
        'if.*actortype.*===.*"earthbound"',
        'if.*actortype.*===.*"spirit"',
        'actortype.*===.*"technocrat"',
        'actortype.*===.*"mage"',
        'actortype.*===.*"demon"',
        'actortype.*===.*"earthbound"',
        'actortype.*===.*"spirit"',
        'usesm20',
        '_initializespheres',
        '_initializelore',
        '_modifysphere',
        '_modifyenlightenment',
        '_updateapocalypticformdropdown',
        'enlightenment',
        'spheres',
        'lore',
        'faith',
        'torment',
        'house',
        'apocalypticform',
        'convention',
        'amalgam',
        'eidolon',
        'tradition',
        'cabal',
        'essence',
        'spirittype'
    ]
    
    for pattern in creature_checks:
        if re.search(pattern, line_lower):
            return True
    
    return False

def should_remove_method(method_name):
    """Check if a method should be removed (creature-specific)"""
    creature_methods = [
        '_initializespheres',
        '_initializelore',
        '_modifysphere',
        '_modifyenlightenment',
        '_updateapocalypticformdropdown'
    ]
    
    return method_name.lower() in [m.lower() for m in creature_methods]

def extract_base_class(input_file, output_file):
    """Extract MortalWizard base class from WodCharacterWizard"""
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace class name
    content = content.replace('export class WodCharacterWizard', 'export class MortalWizard')
    content = content.replace('WodCharacterWizard', 'MortalWizard')
    
    # Remove creature-specific initialization from _initializeWizardData
    # Remove spheres, lore, enlightenment, faith, torment, house, apocalypticForm, etc.
    content = re.sub(r'spheres:\s*this\._initializeSpheres\(\),?\s*\n', '', content)
    content = re.sub(r'lore:\s*this\._initializeLore\(\),?\s*\n', '', content)
    content = re.sub(r'enlightenment:\s*[^,}]+,\s*\n', '', content)
    content = re.sub(r'freebiesSpent:\s*[^,}]+,\s*\n', '', content)
    content = re.sub(r'faith:\s*[^,}]+,\s*\n', '', content)
    content = re.sub(r'torment:\s*[^,}]+,\s*\n', '', content)
    content = re.sub(r'house:\s*"[^"]*",?\s*\n', '', content)
    content = re.sub(r'apocalypticForm:\s*"[^"]*",?\s*\n', '', content)
    content = re.sub(r'convention:\s*"[^"]*",?\s*\n', '', content)
    content = re.sub(r'amalgam:\s*"[^"]*",?\s*\n', '', content)
    content = re.sub(r'eidolon:\s*"[^"]*",?\s*\n', '', content)
    content = re.sub(r'tradition:\s*"[^"]*",?\s*\n', '', content)
    content = re.sub(r'cabal:\s*"[^"]*",?\s*\n', '', content)
    content = re.sub(r'essence:\s*"[^"]*",?\s*\n', '', content)
    
    # Remove creature-specific methods entirely
    methods_to_remove = [
        r'/\*\*[^*]*\*[^/]*\*/\s*_initializeSpheres\([^)]*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}',
        r'/\*\*[^*]*\*[^/]*\*/\s*_initializeLore\([^)]*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}',
        r'/\*\*[^*]*\*[^/]*\*/\s*async\s+_modifySphere\([^)]*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}',
        r'/\*\*[^*]*\*[^/]*\*/\s*async\s+_modifyEnlightenment\([^)]*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}',
        r'/\*\*[^*]*\*[^/]*\*/\s*async\s+_updateApocalypticFormDropdown\([^)]*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}',
    ]
    
    for pattern in methods_to_remove:
        content = re.sub(pattern, '', content, flags=re.DOTALL)
    
    # Remove creature-specific blocks in _loadProgress, getData, _applyToActor, etc.
    # This is complex, so we'll do it line by line
    
    lines = content.split('\n')
    output_lines = []
    skip_block = False
    indent_level = 0
    
    i = 0
    while i < len(lines):
        line = lines[i]
        original_line = line
        
        # Track indentation for block skipping
        stripped = line.lstrip()
        current_indent = len(line) - len(stripped)
        
        # Skip entire methods that are creature-specific
        if re.search(r'^\s*(async\s+)?_initializeSpheres\(', line):
            # Skip until method closes
            brace_count = 0
            while i < len(lines):
                brace_count += lines[i].count('{') - lines[i].count('}')
                if brace_count == 0 and '}' in lines[i]:
                    break
                i += 1
            continue
        
        if re.search(r'^\s*(async\s+)?_initializeLore\(', line):
            brace_count = 0
            while i < len(lines):
                brace_count += lines[i].count('{') - lines[i].count('}')
                if brace_count == 0 and '}' in lines[i]:
                    break
                i += 1
            continue
        
        if re.search(r'^\s*(async\s+)?_modifySphere\(', line):
            brace_count = 0
            while i < len(lines):
                brace_count += lines[i].count('{') - lines[i].count('}')
                if brace_count == 0 and '}' in lines[i]:
                    break
                i += 1
            continue
        
        if re.search(r'^\s*(async\s+)?_modifyEnlightenment\(', line):
            brace_count = 0
            while i < len(lines):
                brace_count += lines[i].count('{') - lines[i].count('}')
                if brace_count == 0 and '}' in lines[i]:
                    break
                i += 1
            continue
        
        if re.search(r'^\s*(async\s+)?_updateApocalypticFormDropdown\(', line):
            brace_count = 0
            while i < len(lines):
                brace_count += lines[i].count('{') - lines[i].count('}')
                if brace_count == 0 and '}' in lines[i]:
                    break
                i += 1
            continue
        
        # Skip creature-specific if blocks
        if re.search(r'if\s*\([^)]*actortype\s*===?\s*["\'](technocrat|mage|demon|earthbound|spirit)', line, re.IGNORECASE):
            # Skip this entire if block
            brace_count = 0
            start_i = i
            while i < len(lines):
                brace_count += lines[i].count('{') - lines[i].count('}')
                if brace_count == 0 and ('}' in lines[i] or 'else' in lines[i]):
                    # Check if there's an else
                    if 'else' in lines[i] and '{' in lines[i]:
                        continue  # Continue skipping
                    break
                i += 1
            continue
        
        # Remove creature-specific lines but keep structure
        if should_remove_line(line):
            # Skip this line but maintain structure
            i += 1
            continue
        
        output_lines.append(line)
        i += 1
    
    output_content = '\n'.join(output_lines)
    
    # Clean up extra blank lines
    output_content = re.sub(r'\n{3,}', '\n\n', output_content)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(output_content)
    
    print(f"Extracted MortalWizard base class to {output_file}")
    print(f"Original: {len(content.splitlines())} lines")
    print(f"Extracted: {len(output_content.splitlines())} lines")

if __name__ == '__main__':
    input_file = 'module/character-creation/wod-character-wizard.js'
    output_file = 'module/character-creation/base/mortal-wizard.js'
    extract_base_class(input_file, output_file)
