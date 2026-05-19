import { footnoteTransformer } from "./footnote";
import { punctuationTransformer } from "./punctuation";
import type { Transformer } from "./types";

export const availableTransformers: Transformer[] = [
  punctuationTransformer,
  footnoteTransformer,
  // Add more transformers here
];
