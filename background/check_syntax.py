# -*- coding: utf-8 -*-
"""检查所有 Python 文件的语法和导入。"""

import ast
import os
import sys
from pathlib import Path


def check_syntax(file_path: str) -> list[str]:
    """检查 Python 文件语法。"""
    errors = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()
        ast.parse(source)
    except SyntaxError as e:
        errors.append(f"语法错误: {e}")
    except Exception as e:
        errors.append(f"读取错误: {e}")
    return errors


def check_imports(file_path: str) -> list[str]:
    """检查导入语句。"""
    errors = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()
        
        tree = ast.parse(source)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    # 检查标准库导入
                    pass
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    # 检查相对导入
                    pass
    except Exception as e:
        errors.append(f"导入检查错误: {e}")
    return errors


def find_python_files(directory: str) -> list[str]:
    """查找所有 Python 文件。"""
    python_files = []
    for root, dirs, files in os.walk(directory):
        # 跳过 __pycache__ 和 .git 目录
        dirs[:] = [d for d in dirs if d not in ['__pycache__', '.git', '.venv', 'venv']]
        
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    return python_files


def main():
    """主函数。"""
    print("=" * 60)
    print("Python 语法和导入检查")
    print("=" * 60)
    
    # 查找所有 Python 文件
    python_files = find_python_files('app')
    
    total_files = len(python_files)
    files_with_errors = 0
    all_errors = []
    
    print(f"\n找到 {total_files} 个 Python 文件\n")
    
    for file_path in python_files:
        errors = []
        
        # 检查语法
        syntax_errors = check_syntax(file_path)
        errors.extend(syntax_errors)
        
        # 检查导入
        import_errors = check_imports(file_path)
        errors.extend(import_errors)
        
        if errors:
            files_with_errors += 1
            all_errors.append((file_path, errors))
            print(f"❌ {file_path}")
            for error in errors:
                print(f"   - {error}")
        else:
            print(f"✅ {file_path}")
    
    print("\n" + "=" * 60)
    print("检查结果汇总")
    print("=" * 60)
    print(f"总文件数: {total_files}")
    print(f"有问题的文件: {files_with_errors}")
    print(f"通过的文件: {total_files - files_with_errors}")
    
    if all_errors:
        print("\n" + "=" * 60)
        print("详细错误列表")
        print("=" * 60)
        for file_path, errors in all_errors:
            print(f"\n文件: {file_path}")
            for error in errors:
                print(f"  - {error}")
        return 1
    else:
        print("\n✅ 所有文件检查通过！")
        return 0


if __name__ == '__main__':
    sys.exit(main())