import { useNavigate } from "react-router-dom";
import { useProfiles } from "@/context/ProfileContext";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Check, Plus, Users } from "lucide-react";

function initials(name) {
  if (!name) return "M";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}

export default function ProfileSwitcher() {
  const navigate = useNavigate();
  const { profiles, active, activeId, switchProfile } = useProfiles();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="profile-switcher"
          aria-label="Switch profile"
          className="pressable h-10 w-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-display font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          style={active?.color ? { backgroundColor: active.color, color: "#fff" } : undefined}
        >
          {initials(active?.name)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Profiles</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profiles.map((p) => (
          <DropdownMenuItem
            key={p.id}
            data-testid="profile-switch-item"
            onClick={() => switchProfile(p.id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ backgroundColor: p.color || "#2A767B" }}>{initials(p.name)}</span>
            <span className="flex-1 truncate">{p.name}</span>
            {p.id === activeId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="profile-manage" onClick={() => navigate("/profile")} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />Manage profiles
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
