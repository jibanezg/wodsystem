#!/usr/bin/env python3
"""
Evaluation script for Earthbound Apocalyptic Powers extraction
Calculates completeness metrics and validates extraction quality
"""

import json
import re
from typing import Dict, List, Set

def load_source_data():
    """Load the source earthbound-apocaliptic.md file"""
    with open('datasource/D20/earthbound-apocaliptic.md', 'r', encoding='utf-8') as f:
        content = f.read()
    return content

def load_extracted_data():
    """Load the extracted apocalyptic_powers.json file"""
    with open('datasource/D20/apocalyptic_powers.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def count_source_features(content: str) -> Dict[str, int]:
    """Count features in source markdown by point cost"""
    counts = {'free': 0, 'one': 0, 'two': 0, 'three': 0, 'four': 0}
    
    # Count free feature (Face of Terror)
    if re.search(r'Face\s+of\s+Terror:', content, re.IGNORECASE):
        counts['free'] = 1
    
    # Count bullet points in each section
    for point_cost in [1, 2, 3, 4]:
        section_pattern = rf'{point_cost}-POINT\s+FEATURES'
        section_match = re.search(section_pattern, content, re.IGNORECASE)
        
        if section_match:
            start_pos = section_match.end()
            next_section_pattern = r'\d+-POINT\s+FEATURES|TOTAL:\s*\d+'
            next_match = re.search(next_section_pattern, content[start_pos:])
            
            if next_match:
                section_content = content[start_pos:start_pos + next_match.start()]
            else:
                section_content = content[start_pos:]
            
            # Count bullet points
            bullet_count = len(re.findall(r'•\s*[^:]+:', section_content))
            
            if point_cost == 1:
                counts['one'] = bullet_count
            elif point_cost == 2:
                counts['two'] = bullet_count
            elif point_cost == 3:
                counts['three'] = bullet_count
            elif point_cost == 4:
                counts['four'] = bullet_count
    
    return counts

def validate_extraction_quality(source_counts: Dict[str, int], extracted_data: Dict) -> Dict:
    """Validate extraction quality and calculate metrics"""
    extracted_features = extracted_data.get('apocalypticPowers', [])
    
    # Count extracted features by point cost
    extracted_counts = {'free': 0, 'one': 0, 'two': 0, 'three': 0, 'four': 0}
    
    for feature in extracted_features:
        cost = feature.get('pointCost', 0)
        if cost == 0:
            extracted_counts['free'] += 1
        elif cost == 1:
            extracted_counts['one'] += 1
        elif cost == 2:
            extracted_counts['two'] += 1
        elif cost == 3:
            extracted_counts['three'] += 1
        elif cost == 4:
            extracted_counts['four'] += 1
    
    # Calculate completeness for each category
    completeness = {}
    total_source = 0
    total_extracted = 0
    
    for category in ['free', 'one', 'two', 'three', 'four']:
        source_count = source_counts[category]
        extracted_count = extracted_counts[category]
        
        if source_count > 0:
            completeness[category] = (extracted_count / source_count) * 100
        else:
            completeness[category] = 100 if extracted_count == 0 else 0
        
        total_source += source_count
        total_extracted += extracted_count
    
    # Overall completeness
    overall_completeness = (total_extracted / total_source * 100) if total_source > 0 else 0
    
    # Check for issues
    issues = []
    
    # Check Face of Terror description contamination
    face_of_terror = next((f for f in extracted_features if f['id'] == 'face_of_terror'), None)
    if face_of_terror:
        desc = face_of_terror.get('description', '')
        if '1-POINT FEATURES' in desc or 'The features listed here are available to all Earthbound' in desc:
            issues.append("Face of Terror description contains section header contamination")
    
    # Check for missing required fields
    for i, feature in enumerate(extracted_features):
        if not feature.get('id'):
            issues.append(f"Feature {i}: Missing ID")
        if not feature.get('name'):
            issues.append(f"Feature {i}: Missing name")
        if feature.get('pointCost') is None:
            issues.append(f"Feature {i}: Missing pointCost")
        if not feature.get('description'):
            issues.append(f"Feature {i}: Missing description")
    
    # Check for duplicate IDs
    ids = [f.get('id') for f in extracted_features if f.get('id')]
    duplicate_ids = [id for id in set(ids) if ids.count(id) > 1]
    if duplicate_ids:
        issues.append(f"Duplicate IDs found: {duplicate_ids}")
    
    return {
        'source_counts': source_counts,
        'extracted_counts': extracted_counts,
        'completeness': completeness,
        'overall_completeness': overall_completeness,
        'total_source': total_source,
        'total_extracted': total_extracted,
        'issues': issues,
        'metadata': extracted_data.get('metadata', {})
    }

def main():
    """Main evaluation function"""
    print("==================================")
    print("EARTHBOUND APOCALYPTIC POWERS EVALUATION")
    print("==================================")
    
    # Load data
    try:
        source_content = load_source_data()
        extracted_data = load_extracted_data()
    except Exception as e:
        print(f"ERROR: Could not load data: {e}")
        return
    
    # Count source features
    print("Analyzing source data...")
    source_counts = count_source_features(source_content)
    print(f"Source feature counts: {source_counts}")
    
    # Validate extraction
    print("\nValidating extraction...")
    results = validate_extraction_quality(source_counts, extracted_data)
    
    # Print results
    print(f"\nSource vs Extracted Comparison:")
    for category in ['free', 'one', 'two', 'three', 'four']:
        source = results['source_counts'][category]
        extracted = results['extracted_counts'][category]
        completeness = results['completeness'][category]
        print(f"  {category.capitalize()}: {source} → {extracted} ({completeness:.1f}%)")
    
    print(f"\nOverall Results:")
    print(f"  Total source features: {results['total_source']}")
    print(f"  Total extracted features: {results['total_extracted']}")
    print(f"  Overall completeness: {results['overall_completeness']:.1f}%")
    
    # Print issues
    if results['issues']:
        print(f"\nIssues Found ({len(results['issues'])}):")
        for issue in results['issues']:
            print(f"  ⚠️  {issue}")
    else:
        print(f"\n✅ No issues found!")
    
    # Print metadata
    metadata = results['metadata']
    if metadata:
        print(f"\nExtraction Metadata:")
        print(f"  Extracted at: {metadata.get('extractedAt', 'Unknown')}")
        print(f"  Source file: {metadata.get('sourceFile', 'Unknown')}")
        print(f"  Total features: {metadata.get('totalFeatures', 'Unknown')}")
        
        point_dist = metadata.get('pointDistribution', {})
        if point_dist:
            print(f"  Point distribution: {point_dist}")
    
    print("\n==================================")
    print("EVALUATION COMPLETE")
    print("==================================")
    
    # Return results for potential use in scripts
    return results

if __name__ == "__main__":
    main()
