/**
 * Utility functions for calculating token offset mappings.
 * This provides offset calculation on top of existing tokenization results.
 */

/**
 * Calculate offset mappings for tokens by re-aligning them with the original text.
 * This is a post-processing approach that works with any tokenizer.
 *
 * @param originalText The original input text
 * @param tokens The tokenized output (without special tokens for alignment)
 * @param allTokens All tokens including special tokens
 * @returns Array of [start, end] offset pairs for each token
 */
export function calculateOffsetMapping(
  originalText: string,
  tokens: string[],
  allTokens: string[]
): Array<[number, number]> {
  const offsets: Array<[number, number]> = [];

  // Handle special tokens at the beginning
  let tokenIndex = 0;
  let textPosition = 0;

  for (const token of allTokens) {
    // Handle special tokens (have no correspondence in original text)
    if (isSpecialToken(token)) {
      offsets.push([0, 0]); // Special tokens get (0,0) offsets
      continue;
    }

    // Clean the token (remove ## prefix for WordPiece)
    const cleanToken = token.startsWith('##') ? token.substring(2) : token;

    // Find this token in the remaining text
    const remainingText = originalText.substring(textPosition);
    const tokenPos = findTokenInText(cleanToken, remainingText);

    if (tokenPos !== -1) {
      const absoluteStart = textPosition + tokenPos;
      const absoluteEnd = absoluteStart + cleanToken.length;
      offsets.push([absoluteStart, absoluteEnd]);
      textPosition = absoluteEnd;
    } else {
      // Fallback: token not found, mark as unknown position
      offsets.push([textPosition, textPosition]);
    }
  }

  return offsets;
}

/**
 * More sophisticated offset calculation specifically for WordPiece tokens.
 * This handles subword reconstruction properly.
 */
export function calculateWordPieceOffsets(
  originalText: string,
  tokens: string[]
): Array<[number, number]> {
  const offsets: Array<[number, number]> = [];
  let currentPos = 0;

  // Normalize text for easier matching
  const normalizedOriginal = originalText.toLowerCase();
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Handle special tokens
    if (isSpecialToken(token)) {
      offsets.push([0, 0]);
      i++;
      continue;
    }

    // Collect consecutive subword tokens
    const subwordGroup: string[] = [token];
    let j = i + 1;

    while (j < tokens.length && tokens[j].startsWith('##')) {
      subwordGroup.push(tokens[j]);
      j++;
    }

    // Reconstruct the full word from subwords
    const fullWord = reconstructWordFromSubtokens(subwordGroup).toLowerCase();

    // Find this word in the remaining text
    const remainingText = normalizedOriginal.substring(currentPos);
    const wordPos = remainingText.indexOf(fullWord);

    if (wordPos !== -1) {
      const absoluteStart = currentPos + wordPos;
      const absoluteEnd = absoluteStart + fullWord.length;

      // Distribute positions across subwords
      const subwordOffsets = distributeOffsetsAcrossSubwords(
        subwordGroup,
        absoluteStart,
        absoluteEnd,
        fullWord
      );

      offsets.push(...subwordOffsets);
      currentPos = absoluteEnd;
    } else {
      // Fallback: assign consecutive positions
      for (let k = 0; k < subwordGroup.length; k++) {
        offsets.push([currentPos, currentPos]);
      }
    }

    i = j;
  }

  return offsets;
}

/**
 * Check if a token is a special token (CLS, SEP, PAD, etc.)
 */
function isSpecialToken(token: string): boolean {
  return token.startsWith('[') && token.endsWith(']');
}

/**
 * Find a token in text, handling case insensitivity and punctuation
 */
function findTokenInText(token: string, text: string): number {
  const normalizedToken = token.toLowerCase();
  const normalizedText = text.toLowerCase();

  // Direct match first
  let pos = normalizedText.indexOf(normalizedToken);
  if (pos !== -1) return pos;

  // Try to find with word boundaries
  const words = normalizedText.split(/\s+/);
  let currentPos = 0;

  for (const word of words) {
    const cleanWord = word.replace(/[^\w]/g, '');
    if (cleanWord.includes(normalizedToken)) {
      const tokenPosInWord = cleanWord.indexOf(normalizedToken);
      if (tokenPosInWord !== -1) {
        return currentPos + normalizedText.substring(currentPos).indexOf(cleanWord) + tokenPosInWord;
      }
    }
    currentPos = normalizedText.indexOf(word, currentPos) + word.length;
  }

  return -1;
}

/**
 * Reconstruct original word from WordPiece subwords
 */
function reconstructWordFromSubtokens(subtokens: string[]): string {
  return subtokens
    .map(token => token.startsWith('##') ? token.substring(2) : token)
    .join('');
}

/**
 * Distribute character offsets across subword tokens
 */
function distributeOffsetsAcrossSubwords(
  subwords: string[],
  startPos: number,
  endPos: number,
  fullWord: string
): Array<[number, number]> {
  const offsets: Array<[number, number]> = [];
  let currentPos = startPos;

  for (const subword of subwords) {
    const cleanSubword = subword.startsWith('##') ? subword.substring(2) : subword;
    const subwordEnd = currentPos + cleanSubword.length;

    offsets.push([currentPos, Math.min(subwordEnd, endPos)]);
    currentPos = subwordEnd;
  }

  return offsets;
}

/**
 * Simple re-alignment approach that works by matching tokens back to original text
 */
export function simpleOffsetAlignment(
  originalText: string,
  tokens: string[]
): Array<[number, number]> {
  const offsets: Array<[number, number]> = [];

  // Remove special tokens for alignment
  const contentTokens = tokens.filter(t => !isSpecialToken(t));
  const reconstructed = contentTokens
    .map(t => t.startsWith('##') ? t.substring(2) : ' ' + t)
    .join('')
    .trim();

  // Simple character-by-character alignment
  let tokenIdx = 0;
  let charIdx = 0;

  for (const token of tokens) {
    if (isSpecialToken(token)) {
      offsets.push([0, 0]);
    } else {
      const cleanToken = token.startsWith('##') ? token.substring(2) : token;
      const start = charIdx;
      const end = start + cleanToken.length;

      offsets.push([start, Math.min(end, originalText.length)]);
      charIdx = end;
    }
  }

  return offsets;
}