'use client'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  console.error(error)

  return (
    <html>
      <head>
        <style>{`
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: ui-sans-serif, system-ui, sans-serif;
            padding: 2rem;
            background: #0b0b10;
            color: #f4f4f5;
            font-size: 14px;
            min-height: 100vh;
            display: flex;
            align-items: flex-start;
          }
          .error-container {
            width: 100%;
            max-width: 560px;
            min-width: 0;
            padding: 1.5rem;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 1rem;
            background: rgba(255,255,255,0.03);
          }
          .error-header {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .error-icon {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #2a1120;
            color: #fda4af;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 12px;
            flex-shrink: 0;
          }
          .error-message {
            margin: 0;
            font-weight: 500;
            line-height: 1.5;
          }
          .error-summary {
            margin: 0.5rem 0 0 2rem;
            padding: 0;
            font-size: 13px;
            color: #f4f4f5;
            line-height: 1.5;
          }
          .error-digest {
            margin: 1rem 0 0 2rem;
            color: #a1a1aa;
            font-size: 12px;
          }
        `}</style>
      </head>
      <body>
        <div className="error-container">
          <div className="error-header">
            <div className="error-icon">!</div>
            <div>
              <p className="error-message">
                Nova hit an unexpected error while loading this page.
              </p>
            </div>
          </div>
          <div className="error-summary">
            Please refresh the page or try again in a moment.
          </div>
          {error.digest && <div className="error-digest">Error reference: {error.digest}</div>}
        </div>
      </body>
    </html>
  )
}
