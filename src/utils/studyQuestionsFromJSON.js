let runtimePromise;

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = import("./studyQuestionsRuntime.js");
  }
  return runtimePromise;
}

export async function loadQuestionsData() {
  const runtime = await loadRuntime();
  return runtime.loadQuestionsData();
}

export async function findAnswer(question) {
  const runtime = await loadRuntime();
  return runtime.findAnswer(question);
}

export async function getQuestionCount() {
  const runtime = await loadRuntime();
  return runtime.getQuestionCount();
}

export async function preloadQuestions() {
  const runtime = await loadRuntime();
  return runtime.preloadQuestions();
}

export async function clearCache() {
  const runtime = await loadRuntime();
  return runtime.clearCache();
}
