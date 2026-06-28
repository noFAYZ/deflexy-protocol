"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function ThemeSwitcher() {
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const [isHovered, setIsHovered] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // ─── Loading Skeleton ────────────────────────────────────
  if (!mounted) {
    return (
      <Button
        data-slot="theme-switcher"
        disabled
        aria-label="Toggle theme"
        size="icon"
        variant="ghost"
        className="relative h-8 w-8 rounded-full"
      >
        <div className="size-4 animate-pulse rounded-full bg-muted-foreground/20" />
      </Button>
    );
  }

  const isDark = theme === "dark" || theme === "dark-pro";

  return (
    <Button
      data-slot="theme-switcher"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      size="icon-sm"
      variant="outline"
      onClick={toggleTheme}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative h-7 w-7 p-1 rounded-full",
        "transition-colors duration-200",
        "hover:bg-accent",
      
      )}
    >
      {/* Container for 3D flip effect */}
      <span
        className={cn(
          "relative flex size-2 items-center justify-center",
          "transition-transform duration-300 [perspective:200px]",
          isDark && "[transform:rotateY(180deg)]"
        )}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Sun - Front face */}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            "transition-opacity duration-200",
            "backface-hidden [backface-visibility:hidden]",
            isDark && "pointer-events-none opacity-0"
          )}
        >
          <Sun
            className={cn(
              "size-3.5 text-orange-500",
              "transition-transform duration-100",
              isHovered && !isDark && "rotate-45 scale-105"
            )}
          />
        </span>

        {/* Moon - Back face */}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            "transition-opacity duration-200",
            "[backface-visibility:hidden] [transform:rotateY(180deg)]",
            !isDark && "pointer-events-none opacity-0"
          )}
        >
          <Moon
            className={cn(
              "size-3.5 text-muted-foreground",
              "transition-transform duration-100",
              isHovered && isDark && "-rotate-12 scale-110"
            )}
          />
        </span>
      </span>
    </Button>
  );
}

export { ThemeSwitcher };