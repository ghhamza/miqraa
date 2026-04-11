// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { ChevronDown, Languages } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGS = ["ar", "en", "fr"] as const;

function normalizeLang(lng: string): (typeof LANGS)[number] {
  const base = (lng.split("-")[0] ?? "ar") as (typeof LANGS)[number];
  return LANGS.includes(base) ? base : "ar";
}

interface LanguageSwitcherProps {
  className?: string;
  /** Icon-focused trigger (e.g. auth pages corner). */
  compact?: boolean;
  /** Stretch trigger to container width (e.g. mobile sheet footer). */
  fullWidth?: boolean;
}

export function LanguageSwitcher({ className = "", compact = false, fullWidth = false }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const current = normalizeLang(i18n.language || "ar");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={cn(
            "shrink-0 border-border text-foreground",
            !compact && "max-w-[min(100%,12rem)] gap-1.5 ps-2.5 pe-2",
            fullWidth && "w-full max-w-none justify-center",
            className,
          )}
          aria-label={t("language.label")}
        >
          {compact ? (
            <Languages className="h-4 w-4" aria-hidden />
          ) : (
            <>
              <Languages className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden min-w-0 flex-1 truncate text-start text-xs font-medium sm:inline">
                {t(`language.${current}`)}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]" sideOffset={6}>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("language.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(v) => {
            void i18n.changeLanguage(v);
          }}
        >
          {LANGS.map((lng) => (
            <DropdownMenuRadioItem key={lng} value={lng} className="cursor-pointer">
              {t(`language.${lng}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
