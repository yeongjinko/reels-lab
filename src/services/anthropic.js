import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

const functions = getFunctions(app, 'asia-northeast3');

const analyzeScriptFn = httpsCallable(functions, 'analyzeScript');
const generateScriptFn = httpsCallable(functions, 'generateScript');
const refineSentenceFn = httpsCallable(functions, 'refineSentence');
const refineAnalysisFn = httpsCallable(functions, 'refineAnalysis');
const generateContextOptionsFn = httpsCallable(functions, 'generateContextOptions');
const updateSentencesWithContextFn = httpsCallable(functions, 'updateSentencesWithContext');
const generateTemplateFn = httpsCallable(functions, 'generateTemplate');
const generateFinalScriptFn = httpsCallable(functions, 'generateFinalScript');

export async function analyzeReference(text) {
  const result = await analyzeScriptFn({ text });
  return result.data; // { success, needsContext, words?, data }
}

export async function generateContextOptions(word, sentence, fullScript) {
  const result = await generateContextOptionsFn({ word, sentence, fullScript });
  return result.data.data; // { options: [{ label, effect }] }
}

export async function updateSentencesWithContext(sentences, contextMap) {
  const result = await updateSentencesWithContextFn({ sentences, contextMap });
  return result.data.data.updates || []; // [{ text, effect }]
}

export async function refineSentence(text, effect, feedback) {
  const result = await refineSentenceFn({ text, effect, feedback });
  return result.data.data; // { effect }
}

export async function refineAnalysis(sentences, hookFormula, hookFormulaDesc, feedback) {
  const result = await refineAnalysisFn({ sentences, hookFormula, hookFormulaDesc, feedback });
  return result.data.data; // { hookFormula, hookFormulaDesc, sentences }
}

export async function generateDraft(productName, features, analysis) {
  const result = await generateScriptFn({ productName, features, analysis });
  return result.data.data;
}

export async function generateTemplate(script) {
  const result = await generateTemplateFn({ script });
  return result.data.data;
}

export async function generateFinalScript(steps, hookType) {
  const result = await generateFinalScriptFn({ steps, hookType });
  return result.data.data; // { script }
}
