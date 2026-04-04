// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  interface Window {
    __DK_BASE__?: string;
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "dk-text": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        just?: string | boolean;
        tajweed?: string | boolean;
        expansion?: string | boolean;
      };
    }
  }
}

export {};
