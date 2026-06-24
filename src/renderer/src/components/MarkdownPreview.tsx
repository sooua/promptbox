import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders markdown. Before handing the text to react-markdown we wrap any
 * {{variable}} tokens in a sentinel so they survive as highlighted chips.
 */
export function MarkdownPreview({ content }: { content: string }): React.JSX.Element {
  const segments = useMemo(() => splitVariables(content), [content])

  if (!content.trim()) {
    return <div className="text-sm text-faint">（空内容）</div>
  }

  return (
    <div className="md text-[15px] leading-[1.7]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Re-highlight variables inside text nodes.
          p: ({ children }) => <p>{highlight(children)}</p>,
          li: ({ children }) => <li>{highlight(children)}</li>
        }}
      >
        {content}
      </ReactMarkdown>
      {segments.length > 1 && null}
    </div>
  )
}

function splitVariables(content: string): string[] {
  return content.split(/(\{\{\s*[a-zA-Z0-9_.-]+\s*\}\})/g)
}

function highlight(children: React.ReactNode): React.ReactNode {
  return mapChildren(children, (text) => {
    const parts = text.split(/(\{\{\s*[a-zA-Z0-9_.-]+\s*\}\})/g)
    return parts.map((part, i) =>
      /^\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}$/.test(part) ? (
        <span key={i} className="var-chip">
          {part}
        </span>
      ) : (
        part
      )
    )
  })
}

function mapChildren(
  children: React.ReactNode,
  fn: (text: string) => React.ReactNode
): React.ReactNode {
  if (typeof children === 'string') return fn(children)
  if (Array.isArray(children)) {
    return children.map((c, i) =>
      typeof c === 'string' ? <span key={i}>{fn(c)}</span> : c
    )
  }
  return children
}
