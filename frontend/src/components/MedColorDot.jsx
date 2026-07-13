import { cn } from "@/lib/utils";
import { Pill } from "lucide-react";

export default function MedColorDot({ color = "#2A767B", size = 40, icon = true, className }) {
  return (
    <div
      className={cn("shrink-0 rounded-2xl flex items-center justify-center", className)}
      style={{ width: size, height: size, backgroundColor: color + "22", color }}
    >
      {icon ? <Pill className="h-1/2 w-1/2" style={{ color }} /> : <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
    </div>
  );
}
