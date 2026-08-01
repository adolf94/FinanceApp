import re
import sys
from pathlib import Path

# Setup paths to allow importing python models
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent
sys.path.append(str(ROOT_DIR / "notif-ingester"))

def parse_cs_classes_and_properties(filepath: Path) -> dict:
    """Parse class names and their serialized properties from C# file."""
    classes = {}
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Find all class blocks
    # Simple class parser: matches public class ClassName and everything inside its brackets
    class_matches = re.finditer(r"public\s+class\s+([a-zA-Z0-9_]+)\s*\{", content)
    for class_match in class_matches:
        class_name = class_match.group(1)
        # Find closing brace of this class block (simple brace counter)
        start_idx = class_match.end()
        brace_count = 1
        end_idx = start_idx
        while brace_count > 0 and end_idx < len(content):
            char = content[end_idx]
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
            end_idx += 1
            
        class_body = content[start_idx:end_idx]
        
        # Parse properties inside this class body
        properties = {}
        prop_pattern = r"((?:\[[a-zA-Z0-9_\(\)\"\s,=]+\]\s*)*)public\s+([a-zA-Z0-9_<>\?\[\]]+)\s+([a-zA-Z0-9_]+)\s*\{\s*get;\s*set;\s*\}"
        prop_matches = re.finditer(prop_pattern, class_body)
        for prop_match in prop_matches:
            attrs = prop_match.group(1)
            type_name = prop_match.group(2)
            prop_name = prop_match.group(3)
            
            if "JsonIgnore" in attrs:
                continue
                
            json_name_match = re.search(r'JsonPropertyName\(\s*"([^"]+)"\s*\)', attrs)
            if json_name_match:
                serialized_name = json_name_match.group(1)
            else:
                serialized_name = prop_name
                
            properties[serialized_name] = type_name
            
        classes[class_name] = properties
        
    return classes

def main():
    print("Checking model synchronization...")
    cs_dir = ROOT_DIR / "backend" / "Models"
    py_dir = ROOT_DIR / "notif-ingester" / "models"
    
    # Try importing models to inspect them
    try:
        import models
    except ImportError as e:
        print(f"Error importing Python models: {e}")
        sys.exit(1)
        
    # Map C# class names directly to Python model classes
    class_mappings = {
        "Account": models.Account,
        "AccountGroup": models.AccountGroup,
        "Vendor": models.Vendor,
        "Transaction": models.Transaction,
        "LedgerEntry": models.LedgerEntry,
        "RecurringTransaction": models.RecurringTransaction,
        "RecurringLedgerEntry": models.RecurringLedgerEntry,
        "RecurringTransactionOccurrence": models.RecurringTransactionOccurrence,
        "PhoneHookMessage": getattr(models, "PhoneHookMessage", None),
        "AiParsedData": getattr(models, "AiParsedData", None),
        "SuggestedAccountCreation": getattr(models, "SuggestedAccountCreation", None),
        "TransactionVector": getattr(models, "TransactionVector", None),
    }
    
    mismatches = 0
    
    # Group C# files to parse
    cs_files = [
        "Account.cs",
        "AccountGroup.cs",
        "Vendor.cs",
        "Transaction.cs",
        "LedgerEntry.cs",
        "RecurringTransaction.cs",
        "PhoneHookMessage.cs",
        "AiParsedData.cs",
        "TransactionVector.cs",
    ]
    
    for cs_file in cs_files:
        cs_path = cs_dir / cs_file
        if not cs_path.exists():
            print(f"[-] C# file missing: {cs_file}")
            mismatches += 1
            continue
            
        cs_classes = parse_cs_classes_and_properties(cs_path)
        
        for cs_class_name, cs_props in cs_classes.items():
            py_class = class_mappings.get(cs_class_name)
            if py_class is None:
                print(f"[-] Python model missing for C# class: {cs_class_name} (in {cs_file})")
                mismatches += 1
                continue
                
            py_fields = py_class.model_fields
            
            for cs_prop in cs_props.keys():
                found = False
                for field_name, field_info in py_fields.items():
                    if field_name == cs_prop or field_info.alias == cs_prop:
                        found = True
                        break
                
                if not found:
                    print(f"[!] Mismatch: C# class '{cs_class_name}' has property '{cs_prop}' but Python model '{py_class.__name__}' is missing it or its alias.")
                    mismatches += 1
                    
    if mismatches == 0:
        print("[+] All models are fully synchronized!")
        sys.exit(0)
    else:
        print(f"[!] Found {mismatches} mismatches.")
        sys.exit(1)

if __name__ == "__main__":
    main()
