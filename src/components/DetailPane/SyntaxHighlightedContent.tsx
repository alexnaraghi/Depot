import { Highlight, themes } from 'prism-react-renderer';
import { getLanguageFromPath } from '@/lib/languageMap';

interface SyntaxHighlightedContentProps {
  content: string;
  fileName: string;
}

/**
 * Renders file content with syntax highlighting using prism-react-renderer.
 * Automatically detects language from file name/extension.
 *
 * @param content - File content as string
 * @param fileName - File name for language detection
 */
export function SyntaxHighlightedContent({ content, fileName }: SyntaxHighlightedContentProps) {
  const language = getLanguageFromPath(fileName);

  return (
    <div className="overflow-auto rounded-md border bg-card">
      <Highlight
        theme={themes.vsDark}
        code={content}
        language={language}
      >
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre
            style={style}
            className="text-sm font-mono p-4 m-0"
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                <span className="inline-block w-12 text-right text-muted-foreground select-none mr-4">
                  {i + 1}
                </span>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
