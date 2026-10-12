// Mistakes always cost accuracy; leaving one unfixed costs more than fixing it.
export const CORRECTED_ERROR_PENALTY = 1
export const UNCORRECTED_ERROR_PENALTY = 2

export interface Score {
  wpm: number
  accuracy: number
  time: number
  correctedErrors: number
  uncorrectedErrors: number
}

/**
 * @param target          the text to type
 * @param typed           what the user ended with (same length as target)
 * @param wrongKeystrokes every wrong character ever typed, including ones later backspaced
 * @param elapsedMs       time from first keystroke to finish
 */
export function scoreTest(target: string, typed: string, wrongKeystrokes: number, elapsedMs: number): Score {
  let correctChars = 0
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === target[i]) correctChars++
  }
  const uncorrectedErrors = typed.length - correctChars
  // Each wrong position still on screen is one wrong keystroke that was never fixed.
  const correctedErrors = Math.max(0, wrongKeystrokes - uncorrectedErrors)

  const penalty = correctedErrors * CORRECTED_ERROR_PENALTY + uncorrectedErrors * UNCORRECTED_ERROR_PENALTY
  const accuracy = Math.max(0, Math.round(((target.length - penalty) / target.length) * 100))

  const minutes = Math.max(elapsedMs, 1000) / 60000
  // Standard net WPM: a "word" is 5 characters, only correct characters count.
  const wpm = Math.round(correctChars / 5 / minutes)

  return { wpm, accuracy, time: Math.round(elapsedMs / 1000), correctedErrors, uncorrectedErrors }
}
