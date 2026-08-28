# -*- coding: utf-8 -*-
"""检查导入是否正确。"""

import ast
import os
import sys
from typing import Dict, List, Set


def get_imports(file_path: str) -> Dict[str, List[str]]:
    """获取文件中的导入语句。"""
    imports = {
        'standard': [],
        'third_party': [],
        'local': [],
    }
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()
        
        tree = ast.parse(source)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports['standard'].append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    if node.module.startswith('.'):
                        imports['local'].append(node.module)
                    elif node.module.startswith('app.'):
                        imports['local'].append(node.module)
                    else:
                        imports['third_party'].append(node.module)
    except Exception as e:
        pass
    
    return imports


def find_python_files(directory: str) -> List[str]:
    """查找所有 Python 文件。"""
    python_files = []
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in ['__pycache__', '.git', '.venv', 'venv']]
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    return python_files


def check_import_availability(module_name: str) -> bool:
    """检查模块是否可用。"""
    try:
        __import__(module_name)
        return True
    except ImportError:
        return False


def main():
    """主函数。"""
    print("=" * 60)
    print("Import Check")
    print("=" * 60)
    
    python_files = find_python_files('app')
    
    # 收集所有导入
    all_imports: Dict[str, Set[str]] = {
        'standard': set(),
        'third_party': set(),
        'local': set(),
    }
    
    file_imports: Dict[str, Dict[str, List[str]]] = {}
    
    for file_path in python_files:
        imports = get_imports(file_path)
        file_imports[file_path] = imports
        
        for category, modules in imports.items():
            all_imports[category].update(modules)
    
    # 检查第三方库
    print("\n[INFO] Third-party imports found:")
    for module in sorted(all_imports['third_party']):
        available = check_import_availability(module.split('.')[0])
        status = "[OK]" if available else "[MISSING]"
        print(f"  {status} {module}")
    
    # 检查本地导入
    print("\n[INFO] Local imports found:")
    for module in sorted(all_imports['local']):
        print(f"  [LOCAL] {module}")
    
    # 统计
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total files: {len(python_files)}")
    print(f"Standard library imports: {len(all_imports['standard'])}")
    print(f"Third-party imports: {len(all_imports['third_party'])}")
    print(f"Local imports: {len(all_imports['local'])}")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())