# -*- coding: utf-8 -*-
"""检查类型注解。"""

import ast
import os
import sys
from typing import Dict, List, Set, Tuple


def check_type_hints(file_path: str) -> List[str]:
    """检查文件中的类型注解。"""
    issues = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()
        
        tree = ast.parse(source)
        
        for node in ast.walk(tree):
            # 检查函数定义
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # 检查返回类型注解
                if node.returns is None:
                    issues.append(f"Line {node.lineno}: Function '{node.name}' missing return type annotation")
                
                # 检查参数类型注解
                for arg in node.args.args:
                    if arg.annotation is None and arg.arg != 'self':
                        issues.append(f"Line {node.lineno}: Parameter '{arg.arg}' in '{node.name}' missing type annotation")
            
            # 检查变量注解
            if isinstance(node, ast.AnnAssign):
                if node.annotation is None:
                    issues.append(f"Line {node.lineno}: Variable missing type annotation")
    
    except Exception as e:
        issues.append(f"Error checking file: {e}")
    
    return issues


def find_python_files(directory: str) -> List[str]:
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
    print("Type Hint Check")
    print("=" * 60)
    
    python_files = find_python_files('app')
    
    total_issues = 0
    files_with_issues = 0
    all_issues: Dict[str, List[str]] = {}
    
    for file_path in python_files:
        issues = check_type_hints(file_path)
        
        if issues:
            files_with_issues += 1
            all_issues[file_path] = issues
            total_issues += len(issues)
            print(f"\n[WARN] {file_path}")
            for issue in issues[:5]:  # 只显示前5个问题
                print(f"  - {issue}")
            if len(issues) > 5:
                print(f"  ... and {len(issues) - 5} more issues")
        else:
            print(f"[OK] {file_path}")
    
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total files: {len(python_files)}")
    print(f"Files with issues: {files_with_issues}")
    print(f"Total issues: {total_issues}")
    
    if total_issues > 0:
        print("\n[INFO] Type hint issues found. Consider adding type annotations for better code quality.")
        return 0
    else:
        print("\n[PASS] All files have proper type hints!")
        return 0


if __name__ == '__main__':
    sys.exit(main())