import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

const functions = getFunctions(app, 'asia-northeast3');

const analyzeScriptFn = httpsCallable(functions, 'analyzeScript');
const generateScriptFn = httpsCallable(functions, 'generateScript');
const refineSentenceFn = httpsCallable(functions, 'refineSentence');
const refineAnalysisFn = httpsCallable(functions, 'refineAnalysis');

export async function analyzeReference(text, shopType, wordContexts = []) {
  const result = await analyzeScriptFn({ text, shopType, wordContexts });
  return result.data; // { success, needsContext, data?, words? }
}

export async function refineSentence(text, effect, feedback) {
  const result = await refineSentenceFn({ text, effect, feedback });
  return result.data.data; // { effect }
}

export async function refineAnalysis(sentences, hookFormula, hookFormulaDesc, feedback) {
  const result = await refineAnalysisFn({ sentences, hookFormula, hookFormulaDesc, feedback });
  return result.data.data; // { hookFormula, hookFormulaDesc, sentences }
}

export async function generateDraft(productName, features, analysis, shopType) {
  const result = await generateScriptFn({ productName, features, analysis, shopType });
  return result.data.data;
}
