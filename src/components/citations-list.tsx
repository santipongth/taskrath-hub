import { BookText } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export type Citation = {
  index: number;
  chunkId: string;
  documentId: string;
  title: string;
  category: string;
  source: string | null;
  similarity: number;
  snippet: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  regulation: "ระเบียบ",
  circular: "หนังสือเวียน",
  manual: "คู่มือ",
  law: "กฎหมาย",
  other: "อื่นๆ",
};

export function CitationsList({ citations }: { citations: Citation[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <BookText className="h-3.5 w-3.5" />
        อ้างอิงจากระเบียบที่เกี่ยวข้อง
      </div>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((c) => (
          <Popover key={c.chunkId}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted">
                <span className="font-mono text-primary">[{c.index}]</span>
                <span className="max-w-[200px] truncate">{c.title}</span>
                <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                  {Math.round(c.similarity * 100)}%
                </Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-96 text-xs">
              <div className="mb-1 font-semibold">{c.title}</div>
              <div className="mb-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{CATEGORY_LABELS[c.category] ?? c.category}</span>
                {c.source && <span>· {c.source}</span>}
                <span>· similarity {c.similarity.toFixed(3)}</span>
              </div>
              <div className="whitespace-pre-wrap rounded bg-muted p-2 text-foreground">
                {c.snippet}
                {c.snippet.length >= 240 && "…"}
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </div>
  );
}
