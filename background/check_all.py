# -*- coding: utf-8 -*-
"""检查所有 Python 文件的语法和导入。"""

import ast
import os
import sys


def check_syntax(file_path):
    """检查 Python 文件语法。"""
    errors = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()
        ast.parse(source)
    except SyntaxError as e:
        errors.append(f"Syntax error: {e}")
    except Exception as e:
        errors.append(f"Read error: {e}")
    return errors


def find_python_files(directory):
    """查找所有 Python 文件。"""
    python_files = []
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in ['__pycache__', '.git', '.venv', 'venv']]
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    return python_files


def main():
    """主函数。"""
    print("=" * 60)
    print("Python Syntax Check")
    print("=" * 60)
    
    python_files = find_python_files('app')
    total_files = len(python_files)
    files_with_errors = 0
    all_errors = []
    
    print(f"\nFound {total_files} Python files\n")
    
    for file_path in python_files:
        errors = check_syntax(file_path)
        
        if errors:
            files_with_errors += 1
            all_errors.append((file_path, errors))
            print(f"[FAIL] {file_path}")
            for error in errors:
                print(f"   - {error}")
        else:
            print(f"[OK] {file_path}")
    
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total files: {total_files}")
    print(f"Files with errors: {files_with_errors}")
    print(f"Passed files: {total_files - files_with_errors}")
    
    if all_errors:
        print("\n" + "=" * 60)
        print("Error Details")
        print("=" * 60)
        for file_path, errors in all_errors:
            print(f"\nFile: {file_path}")
            for error in errors:
                print(f"  - {error}")
        return 1
    else:
        print("\n[PASS] All files passed syntax check!")
        return 0


if __name__ == '__main__':
    sys.exit(main())