/**
 * Maps file extensions and filenames to Prism language identifiers.
 * Used for syntax highlighting in the file content viewer.
 */

/**
 * Get the Prism language identifier for a file path.
 * Handles both extension-based and filename-based detection.
 *
 * @param filePath - Full path or filename to detect language from
 * @returns Prism language identifier (defaults to 'plaintext' for unknown)
 */
export function getLanguageFromPath(filePath: string): string {
  // Extract filename from path (handle both / and \ separators)
  const fileName = filePath.split(/[/\\]/).pop() || '';

  // Check for extensionless files first (exact filename match)
  const extensionlessMap: Record<string, string> = {
    'Makefile': 'makefile',
    'makefile': 'makefile',
    'Dockerfile': 'docker',
    'dockerfile': 'docker',
    'Jenkinsfile': 'groovy',
    'jenkinsfile': 'groovy',
  };

  if (extensionlessMap[fileName]) {
    return extensionlessMap[fileName];
  }

  // Extract extension (everything after the last dot)
  const extension = fileName.includes('.')
    ? fileName.split('.').pop()?.toLowerCase()
    : undefined;

  if (!extension) {
    return 'plaintext';
  }

  // Map common file extensions to Prism language identifiers
  const extensionToLanguage: Record<string, string> = {
    // Web - JavaScript/TypeScript
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'mjs': 'javascript',
    'cjs': 'javascript',

    // Web - Markup/Styling
    'html': 'markup',
    'htm': 'markup',
    'xml': 'markup',
    'svg': 'markup',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',

    // Data formats
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'cfg': 'ini',
    'conf': 'ini',

    // Systems - C/C++
    'c': 'c',
    'h': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'hpp': 'cpp',
    'hh': 'cpp',
    'hxx': 'cpp',

    // Systems - Other compiled
    'cs': 'csharp',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'kt': 'kotlin',
    'swift': 'swift',

    // Scripting
    'py': 'python',
    'rb': 'ruby',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'bat': 'batch',
    'cmd': 'batch',
    'ps1': 'powershell',
    'psm1': 'powershell',
    'psd1': 'powershell',
    'pl': 'perl',
    'php': 'php',
    'lua': 'lua',

    // Documentation
    'md': 'markdown',
    'mdx': 'markdown',
    'rst': 'rest',
    'txt': 'plaintext',

    // Query languages
    'sql': 'sql',
    'graphql': 'graphql',
    'gql': 'graphql',

    // Other
    'r': 'r',
    'dart': 'dart',
    'scala': 'scala',
    'vim': 'vim',
  };

  return extensionToLanguage[extension] || 'plaintext';
}
