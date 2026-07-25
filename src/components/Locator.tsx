"use client";

import { useEffect } from "react";

export function Locator() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      import("@locator/runtime").then((setupLocatorUI) => {
        setupLocatorUI.default();
      });
    }
  }, []);

  return null;
}