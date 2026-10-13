import { describe, expect, it } from "vitest"
import { scoreTest } from "./scoring"

const ONE_MINUTE = 60_000

describe("scoreTest", () => {
  it("gives 100% accuracy for a perfect run", () => {
    const score = scoreTest("hello world", "hello world", 0, ONE_MINUTE)
    expect(score.accuracy).toBe(100)
    expect(score.correctedErrors).toBe(0)
    expect(score.uncorrectedErrors).toBe(0)
  })

  it("penalizes mistakes that were fixed", () => {
    // 10 chars, 1 wrong keystroke later backspaced: penalty 1 -> 90%
    const score = scoreTest("abcdefghij", "abcdefghij", 1, ONE_MINUTE)
    expect(score.correctedErrors).toBe(1)
    expect(score.uncorrectedErrors).toBe(0)
    expect(score.accuracy).toBe(90)
  })

  it("penalizes unfixed mistakes twice as much as fixed ones", () => {
    // 10 chars, 1 wrong char left in place: penalty 2 -> 80%
    const unfixed = scoreTest("abcdefghij", "abcdefghiX", 1, ONE_MINUTE)
    expect(unfixed.uncorrectedErrors).toBe(1)
    expect(unfixed.correctedErrors).toBe(0)
    expect(unfixed.accuracy).toBe(80)

    const fixed = scoreTest("abcdefghij", "abcdefghij", 1, ONE_MINUTE)
    expect(unfixed.accuracy).toBeLessThan(fixed.accuracy)
  })

  it("counts fixed and unfixed mistakes together", () => {
    // 3 wrong keystrokes total, 1 still on screen -> 2 fixed, 1 unfixed: penalty 4 -> 60%
    const score = scoreTest("abcdefghij", "Xbcdefghij", 3, ONE_MINUTE)
    expect(score.correctedErrors).toBe(2)
    expect(score.uncorrectedErrors).toBe(1)
    expect(score.accuracy).toBe(60)
  })

  it("never goes below 0% accuracy", () => {
    expect(scoreTest("ab", "XY", 50, ONE_MINUTE).accuracy).toBe(0)
  })

  it("computes net WPM from correct characters / 5", () => {
    // 50 correct chars in one minute = 10 WPM
    const text = "a".repeat(50)
    expect(scoreTest(text, text, 0, ONE_MINUTE).wpm).toBe(10)
  })

  it("excludes wrong characters from WPM", () => {
    // 45 correct of 50 in one minute = 9 WPM
    const target = "a".repeat(50)
    const typed = "a".repeat(45) + "b".repeat(5)
    expect(scoreTest(target, typed, 5, ONE_MINUTE).wpm).toBe(9)
  })

  it("does not divide by zero for an instant finish", () => {
    const score = scoreTest("a", "a", 0, 0)
    expect(Number.isFinite(score.wpm)).toBe(true)
    expect(score.time).toBe(0)
  })

  it("reports time in whole seconds", () => {
    expect(scoreTest("a", "a", 0, 12_400).time).toBe(12)
  })
})
