import { BookOpen, Github } from "lucide-react";

export function AdminFooter() {
  return (
    <footer className="border-t bg-background/50 px-6 py-3 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-foreground tracking-tight">CodeVector</span>
        <span>v0.1.0</span>
        <span className="text-border">•</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          API Connected
        </span>
      </div>

      <div className="flex items-center gap-4">
        <a
          href="/api/docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Documentation</span>
        </a>
        <a
          href="https://github.com/codevector/codevector"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Github className="h-3.5 w-3.5" />
          <span>GitHub</span>
        </a>
      </div>
    </footer>
  );
}
