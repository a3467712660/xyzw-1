export function useGameCardBatchAction() {
  const runBatchedCount = async ({
    total,
    batchSize = 1,
    executeBatch,
  }) => {
    const normalizedTotal = Math.max(0, Number(total) || 0);
    const normalizedBatchSize = Math.max(1, Number(batchSize) || 1);

    if (normalizedTotal <= 0 || typeof executeBatch !== "function") {
      return;
    }

    const fullBatchCount = Math.floor(normalizedTotal / normalizedBatchSize);
    const remainder = normalizedTotal % normalizedBatchSize;

    for (let index = 0; index < fullBatchCount; index += 1) {
      const result = await executeBatch(normalizedBatchSize, index);
      if (result === false) {
        return;
      }
    }

    if (remainder > 0) {
      await executeBatch(remainder, fullBatchCount);
    }
  };

  return {
    runBatchedCount,
  };
}
