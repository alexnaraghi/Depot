#!/usr/bin/env python3
"""
Generate a realistic P4 depot structure with thousands of files for testing.
"""

import os
import sys
import stat
import argparse
import random
import subprocess
from pathlib import Path


# File content templates
SOURCE_TEMPLATES = [
    """// {filename}
#include <iostream>

namespace {namespace} {{
    class {classname} {{
    public:
        {classname}();
        ~{classname}();
        void process();
        int getValue() const;
    private:
        int m_value;
    }};
}}
""",
    """// {filename}
public class {classname} {{
    private int value;
    private String name;

    public {classname}(String name) {{
        this.name = name;
        this.value = 0;
    }}

    public void execute() {{
        // Implementation here
    }}
}}
""",
    """# {filename}
class {classname}:
    def __init__(self, name):
        self.name = name
        self.value = 0

    def process(self):
        \"\"\"Process the data\"\"\"
        pass

    def get_value(self):
        return self.value
""",
]

TEST_TEMPLATE = """// Test: {filename}
#include <gtest/gtest.h>
#include "{header}"

TEST({suite}, {testname}) {{
    // Arrange
    auto obj = {classname}();

    // Act
    obj.process();

    // Assert
    EXPECT_TRUE(obj.getValue() > 0);
}}

TEST({suite}, {testname}2) {{
    EXPECT_EQ(1, 1);
}}
"""

CONFIG_TEMPLATE = """{{
    "name": "{name}",
    "version": "1.0.0",
    "settings": {{
        "enabled": true,
        "timeout": 3000,
        "retries": 3
    }},
    "dependencies": [
        "core",
        "utils",
        "logging"
    ]
}}
"""

DOC_TEMPLATE = """# {title}

## Overview
This document describes the {component} component.

## Features
- Feature 1: Core functionality
- Feature 2: Extended operations
- Feature 3: Error handling

## Usage
```
{classname} obj;
obj.process();
```

## API Reference
See the header files for detailed API documentation.
"""


COMPONENT_NAMES = [
    "Database", "Network", "FileSystem", "Parser", "Renderer", "Controller",
    "Manager", "Service", "Handler", "Processor", "Cache", "Logger",
    "Validator", "Transformer", "Analyzer", "Optimizer", "Monitor", "Scheduler",
    "Allocator", "Registry", "Factory", "Builder", "Adapter", "Facade"
]

UTIL_NAMES = [
    "StringUtils", "MathUtils", "DateUtils", "FileUtils", "NetworkUtils",
    "JsonUtils", "XmlUtils", "CryptoUtils", "CompressionUtils", "ValidationUtils"
]


def set_permissions(path):
    """Set standard permissions on a file or directory."""
    try:
        os.chmod(path, stat.S_IWRITE | stat.S_IREAD)
    except Exception:
        pass


def create_file(path, content):
    """Create a file with the given content."""
    # Create parent directories
    path.parent.mkdir(parents=True, exist_ok=True)

    # Set permissions on all parent directories
    for parent in path.parents:
        if parent.exists():
            set_permissions(parent)

    # Write the file
    path.write_text(content, encoding='utf-8')

    # Set permissions on the file
    set_permissions(path)


def generate_source_file(path, namespace, component):
    """Generate a source code file."""
    filename = path.name
    classname = path.stem.replace('_', '')
    template = random.choice(SOURCE_TEMPLATES)

    content = template.format(
        filename=filename,
        namespace=namespace,
        classname=classname,
        component=component
    )
    create_file(path, content)


def generate_test_file(path, component):
    """Generate a test file."""
    filename = path.name
    classname = component
    suite = f"{component}Test"
    testname = path.stem.replace('_', '')
    header = f"{component}.h"

    content = TEST_TEMPLATE.format(
        filename=filename,
        suite=suite,
        testname=testname,
        classname=classname,
        header=header
    )
    create_file(path, content)


def generate_config_file(path, name):
    """Generate a config file."""
    content = CONFIG_TEMPLATE.format(name=name)
    create_file(path, content)


def generate_doc_file(path, component):
    """Generate a documentation file."""
    title = path.stem.replace('_', ' ').title()
    classname = component

    content = DOC_TEMPLATE.format(
        title=title,
        component=component,
        classname=classname
    )
    create_file(path, content)


def generate_project(base_path, project_name, components_count, files_per_component):
    """Generate a single project with components."""
    project_path = base_path / project_name
    file_count = 0

    # Select components for this project
    components = random.sample(COMPONENT_NAMES, min(components_count, len(COMPONENT_NAMES)))

    for component in components:
        component_path = project_path / "src" / component.lower()

        # Generate source files
        for i in range(files_per_component):
            file_path = component_path / f"{component.lower()}_{i}.cpp"
            generate_source_file(file_path, project_name.replace('-', '_'), component)
            file_count += 1

            # Header file
            header_path = component_path / f"{component.lower()}_{i}.h"
            generate_source_file(header_path, project_name.replace('-', '_'), component)
            file_count += 1

        # Generate test files
        test_path = project_path / "tests" / "unit" / component.lower()
        for i in range(files_per_component // 2):
            test_file = test_path / f"test_{component.lower()}_{i}.cpp"
            generate_test_file(test_file, component)
            file_count += 1

    # Generate utility files
    utils_path = project_path / "src" / "utils"
    for util in random.sample(UTIL_NAMES, min(5, len(UTIL_NAMES))):
        util_file = utils_path / f"{util}.cpp"
        generate_source_file(util_file, project_name.replace('-', '_'), util)
        file_count += 1

    # Generate config files
    config_path = project_path / "config"
    for config_name in ["build", "deploy", "test", "lint"]:
        config_file = config_path / f"{config_name}.json"
        generate_config_file(config_file, config_name)
        file_count += 1

    # Generate docs
    docs_path = project_path / "docs"
    for doc_name in ["README", "CONTRIBUTING", "ARCHITECTURE", "API"]:
        doc_file = docs_path / f"{doc_name}.md"
        generate_doc_file(doc_file, project_name)
        file_count += 1

    # Integration tests
    integration_path = project_path / "tests" / "integration"
    for i in range(5):
        test_file = integration_path / f"integration_test_{i}.cpp"
        generate_test_file(test_file, project_name)
        file_count += 1

    return file_count


def main():
    parser = argparse.ArgumentParser(
        description='Generate a realistic P4 depot structure with thousands of files'
    )
    parser.add_argument(
        'directory',
        help='Directory to create the depot structure in'
    )
    parser.add_argument(
        '--projects',
        type=int,
        default=20,
        help='Number of projects to generate (default: 20)'
    )
    parser.add_argument(
        '--components',
        type=int,
        default=12,
        help='Number of components per project (default: 12)'
    )
    parser.add_argument(
        '--files-per-component',
        type=int,
        default=8,
        help='Number of source files per component (default: 8)'
    )

    args = parser.parse_args()

    base_path = Path(args.directory)

    print(f"Generating depot structure in: {base_path}")
    print(f"  Projects: {args.projects}")
    print(f"  Components per project: {args.components}")
    print(f"  Files per component: {args.files_per_component}")
    print()

    total_files = 0

    for i in range(args.projects):
        project_name = f"project-{i+1:02d}"
        print(f"Generating {project_name}...", end=' ', flush=True)

        file_count = generate_project(
            base_path,
            project_name,
            args.components,
            args.files_per_component
        )
        total_files += file_count
        print(f"{file_count} files")

    print()
    print(f"✓ Complete!")
    print(f"  Total files: {total_files}")
    print(f"  Location: {base_path.absolute()}")
    print()
    print("Files created with standard permissions (no ownership restrictions).")


if __name__ == '__main__':
    main()
