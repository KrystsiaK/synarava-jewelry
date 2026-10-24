"use client";

import { useState } from "react";

/** Intentional lint error: conditional hook call (react-hooks/rules-of-hooks). */
export function CiProofLintFail() {
  if (true) {
    useState(0);
  }
  return null;
}
