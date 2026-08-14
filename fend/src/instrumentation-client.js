// Some browsers can report a negative performance timeline end value during
// an early navigation. Next.js uses performance.measure for diagnostics; a
// diagnostics failure must not interrupt hydration or page interaction.
if (typeof window !== "undefined" && typeof window.performance?.measure === "function") {
  const nativeMeasure = window.performance.measure.bind(window.performance);

  window.performance.measure = (...args) => {
    try {
      return nativeMeasure(...args);
    } catch (error) {
      if (error instanceof TypeError && /end cannot be negative/i.test(error.message || "")) {
        return undefined;
      }
      throw error;
    }
  };
}
