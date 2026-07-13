import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export default function Markdown({ children, className }) {
  return (
    <div
      className={cn(
        "text-[15px] leading-6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <p className="my-2" {...props} />,
          ul: (props) => <ul className="my-2 ml-5 list-disc space-y-1" {...props} />,
          ol: (props) => <ol className="my-2 ml-5 list-decimal space-y-1" {...props} />,
          li: (props) => <li className="leading-6" {...props} />,
          h1: (props) => <h1 className="font-display text-lg font-semibold mt-3 mb-1.5" {...props} />,
          h2: (props) => <h2 className="font-display text-base font-semibold mt-3 mb-1.5" {...props} />,
          h3: (props) => <h3 className="font-semibold mt-2.5 mb-1" {...props} />,
          strong: (props) => <strong className="font-semibold" {...props} />,
          em: (props) => <em className="italic" {...props} />,
          a: (props) => <a className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />,
          code: (props) => <code className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-mono" {...props} />,
          pre: (props) => <pre className="my-2 overflow-x-auto rounded-xl bg-muted p-3 text-[13px] font-mono" {...props} />,
          blockquote: (props) => <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground" {...props} />,
          table: (props) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full text-sm border-collapse" {...props} />
            </div>
          ),
          th: (props) => <th className="border border-border px-2 py-1 text-left font-semibold bg-muted/50" {...props} />,
          td: (props) => <td className="border border-border px-2 py-1" {...props} />,
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
