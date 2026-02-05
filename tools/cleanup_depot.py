#!/usr/bin/env python3
"""
Force delete a depot directory by handling permissions and attributes.
"""

import os
import sys
import stat
import shutil
import argparse
from pathlib import Path


def remove_readonly(func, path, excinfo):
    """Error handler for shutil.rmtree to handle read-only files."""
    # Clear the readonly bit and try again
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception as e:
        print(f"Warning: Could not delete {path}: {e}")


def force_delete_directory(directory):
    """Force delete a directory and all its contents."""
    path = Path(directory)

    if not path.exists():
        print(f"Directory does not exist: {path}")
        return False

    if not path.is_dir():
        print(f"Not a directory: {path}")
        return False

    print(f"Force deleting: {path.absolute()}")
    print("This may take a moment...")

    try:
        # Use shutil.rmtree with error handler
        shutil.rmtree(path, onerror=remove_readonly)
        print(f"✓ Successfully deleted {path}")
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        print("\nTrying alternative method...")

        # Alternative: walk and delete manually
        try:
            for root, dirs, files in os.walk(path, topdown=False):
                for name in files:
                    file_path = os.path.join(root, name)
                    try:
                        os.chmod(file_path, stat.S_IWRITE)
                        os.remove(file_path)
                    except Exception as fe:
                        print(f"Could not delete file: {file_path}: {fe}")

                for name in dirs:
                    dir_path = os.path.join(root, name)
                    try:
                        os.chmod(dir_path, stat.S_IWRITE)
                        os.rmdir(dir_path)
                    except Exception as de:
                        print(f"Could not delete directory: {dir_path}: {de}")

            # Finally remove the root directory
            os.rmdir(path)
            print(f"✓ Successfully deleted {path}")
            return True

        except Exception as e2:
            print(f"✗ Alternative method also failed: {e2}")
            print("\nPlease try running as Administrator or check if files are in use.")
            return False


def main():
    parser = argparse.ArgumentParser(
        description='Force delete a depot directory with permission handling'
    )
    parser.add_argument(
        'directory',
        help='Directory to delete'
    )
    parser.add_argument(
        '--yes',
        '-y',
        action='store_true',
        help='Skip confirmation prompt'
    )

    args = parser.parse_args()

    path = Path(args.directory)

    if not path.exists():
        print(f"Directory does not exist: {path}")
        return

    # Confirm deletion
    if not args.yes:
        print(f"About to DELETE: {path.absolute()}")
        response = input("Are you sure? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("Cancelled.")
            return

    success = force_delete_directory(args.directory)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
