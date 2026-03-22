/**
 * 从 answer.json 文件加载题目数据的答题工具
 * 用于一键答题功能，从公共目录读取题目数据
 */

const queryPromise = (async () => {
  const base
    = typeof import.meta !== "undefined"
      && import.meta.env
      && import.meta.env.BASE_URL
      ? import.meta.env.BASE_URL
      : "/";

  const candidates = [
    `${base.replace(/\/$/, "")}/answer.json`,
    "/answer.json",
    "answer.json",
  ];

  for (let i = 0; i < candidates.length; i++) {
    const url = candidates[i];
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        try {
          const text = await response.text();
          console.warn(
            `studyQuestionsFromJSON: ${url} returned non-JSON response (length ${text.length})`,
          );
        } catch {
          // ignore
        }
        continue;
      }

      return await response.json();
    } catch (error) {
      console.warn(`studyQuestionsFromJSON: failed to fetch ${url}:`, error);
      continue;
    }
  }

  console.error("❌ 加载答题数据失败: 无法找到 answer.json（尝试了多个路径）");
  return [];
})();

export async function loadQuestionsData() {
  return queryPromise;
}

export function matchQuestion(questionFromDB, actualQuestion, threshold = 1) {
  if (!questionFromDB || !actualQuestion) {
    return false;
  }

  if (threshold === 1) {
    const cleanDB = questionFromDB.replace(/\s+/g, "").toLowerCase();
    const cleanActual = actualQuestion.replace(/\s+/g, "").toLowerCase();

    return cleanActual.includes(cleanDB) || cleanDB.includes(cleanActual);
  }

  return false;
}

export async function findAnswer(question) {
  try {
    const questions = await loadQuestionsData();

    if (!questions || questions.length === 0) {
      return null;
    }

    for (let i = 0; i < questions.length; i++) {
      const item = questions[i];
      if (!item.name || !item.value) {
        continue;
      }

      if (matchQuestion(item.name, question, 1)) {
        return item.value;
      }
    }

    return null;
  } catch (error) {
    console.error("❌ 查找答案时出错:", error);
    return null;
  }
}

export async function getQuestionCount() {
  const questions = await loadQuestionsData();
  return questions ? questions.length : 0;
}

export async function preloadQuestions() {
  try {
    await loadQuestionsData();
  } catch (error) {
    console.error("❌ 答题数据预加载失败:", error);
  }
}

export function clearCache() {
  // The runtime cache is module-scoped via queryPromise; no-op for compatibility.
}
