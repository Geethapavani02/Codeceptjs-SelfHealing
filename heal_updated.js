const { heal, ai } = require('codeceptjs');
const Helper = require('@codeceptjs/helper');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log("✅ SelfHealingHelper loaded successfully.");
// ------------------ HEAL RECIPES ------------------
heal.addRecipe('ai', {
 priority: 10,
 prepare: { html: ({ I }) => I.grabHTMLFrom('body') },
 suggest: true,
 steps: ['click', 'fillField', 'appendField', 'selectOption', 'attachFile', 'checkOption', 'uncheckOption', 'doubleClick'],
 fn: async args => ai.healFailedStep(args),
});
heal.addRecipe('clickAndType', {
 priority: 2,
 steps: ['fillField', 'appendField'],
 fn: async ({ step }) => {
   console.log("Executing clickAndType recipe...");
   const locator = step.args[0];
   const text = step.args[1];
   let i = 1;
   return ({ I }) => {
     console.log(i++, `Clicking on locator: ${locator} and typing: ${text}`);
     I.click(locator);
     I.wait(1);
     I.type(text);
   };
 },
});
heal.addRecipe('reload_on_click_fail', {
 priority: 10,
 steps: ['click'],
 fn: async () => ({ I }) => {
   I.refreshPage();
 },
});
module.exports = { heal };
// ------------------ SELF-HEALING HELPER ------------------
module.exports = class SelfHealingHelper extends Helper {
 // ------------------ FAILED TEST HANDLER ------------------
 async _failed(test) {
   console.log("\n🧠 [Self-Healing] Test failed. Attempting GenAI healing...");
   const errMsg = test.err?.message || '';
   if (
     errMsg.includes("Locator") ||
     errMsg.includes("not found") ||
     errMsg.includes("No node found") ||
     errMsg.includes("Cannot find") ||
     errMsg.includes("element is not visible") ||
     errMsg.includes("Target closed")
   ) {
     const selectors = require('./selectors.js');
     const uiActions = Array.from(
       new Set(Object.values(heal.recipes || {}).flatMap(r => r.steps || []))
     );
     const failedSteps = [];
     for (let i = test.steps.length - 1; i >= 0; i--) {
       const step = test.steps[i];
       if (uiActions.includes(step.name) && step.actor === 'I') {
         failedSteps.push(step);
       }
     }
     const I = this.helpers.Playwright;
     for (const failedStep of failedSteps) {
       let failedSelector = failedStep?.args?.[0] || null;
       let selectorKey = null;
       // Try match from selectors.js
       for (const key in selectors) {
         const s = selectors[key];
         if ((s.css && normalizeSelector(s.css) === normalizeSelector(failedSelector)) ||
             (s.xpath && s.xpath === failedSelector)) {
           selectorKey = key;
           break;
         }
       }
       // Fallback to step name
       if (!selectorKey) selectorKey = failedStep.name;
       // Grab HTML for GenAI
       const html = await I.grabHTMLFrom('body');
       const failingStepTrace = test.err?.stack || test.err?.message || "No stack trace";
       const prompt = `
A CodeceptJS Playwright test failed because the selector "${selectorKey}" is broken.
HTML of the page:
${html}
Error trace:
${failingStepTrace}
Suggest a working CSS or XPath selector in this exact format:
${selectorKey}: { css: "<selector>" }
or
${selectorKey}: { xpath: "<selector>" }
Return only the one-line entry.
`;
       // Call GenAI
       let selectorLine;
       try {
         const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
         const result = await model.generateContent(prompt);
         const response = await result.response;
         selectorLine = response.text().trim();
         console.log(`[Self-Healing] 🤖 GenAI response: ${selectorLine}`);
       } catch (err) {
         console.error('[Self-Healing] Failed to get GenAI suggestion:', err.message);
         continue;
       }
       // Parse GenAI output
       let key, type, selector;
       try {
         ({ key, type, selector } = await this.parseSelectorLine(selectorLine));
       } catch (e) {
         console.error('[Self-Healing] Failed to parse GenAI line:', e.message);
         continue;
       }
       // Validate selector
       if (!selector || typeof selector !== 'string') {
         console.warn('[Self-Healing] Invalid selector from GenAI, skipping:', selector);
         continue;
       }
       const finalKey = selectorKey || key;
       // Update selectors.js safely (object-based)
       await this.updateSelectorKeyValue(finalKey, selector, type);
       // Reload updated selectors
       const selectorsPath = path.resolve(__dirname, './selectors.js');
       delete require.cache[require.resolve(selectorsPath)];
       const updatedSelectors = require(selectorsPath);
       // Prepare arguments for retry
       const args = [...failedStep.args];
       if (updatedSelectors[finalKey]) {
         const newSel = updatedSelectors[finalKey].css || updatedSelectors[finalKey].xpath;
         if (newSel && typeof newSel === 'string') {
           args[0] = newSel;
         } else {
           console.warn(`[Self-Healing] Skipping step "${failedStep.name}": invalid selector after update`, newSel);
           continue;
         }
       } else if (!args[0] || typeof args[0] !== 'string') {
         console.warn(`[Self-Healing] Skipping step "${failedStep.name}": no valid selector`);
         continue;
       }
       // Retry step safely
       try {
         console.log(`[Self-Healing] Retrying step "${failedStep.name}" with args:`, args);
         await I[failedStep.name](...args);
         console.log(`[Self-Healing] ✅ Step "${failedStep.name}" passed after healing`);
       } catch (err) {
         console.error(`[Self-Healing] ❌ Step retry failed:`, err.message);
       }
     }
   }
 }
 // ------------------ PARSE GENAI OUTPUT ------------------
 async parseSelectorLine(line) {
   const regex = /^(\w+)\s*:\s*\{\s*(css|xpath)\s*:\s*['"](.*?)['"]\s*\}/i;
   const match = line.match(regex);
   if (!match) throw new Error(`Invalid selector format: ${line}`);
   return { key: match[1], type: match[2], selector: match[3].trim() };
 }
 // ------------------ UPDATE SELECTORS.JS ------------------
 async updateSelectorKeyValue(selectorKey, newSelector, prop) {
   const selectorsPath = path.resolve(__dirname, './selectors.js');
   // Load existing selectors object
   delete require.cache[require.resolve(selectorsPath)];
   let selectorsObj = {};
   try { selectorsObj = require(selectorsPath); } catch(e){}
   if (!selectorsObj[selectorKey]) selectorsObj[selectorKey] = {};
   selectorsObj[selectorKey][prop] = newSelector;
   // Write updated file
   const newContent = `module.exports = ${JSON.stringify(selectorsObj, null, 2)};\n`;
   await fs.writeFile(selectorsPath, newContent, 'utf-8');
   console.log(`[Self-Healing] 📝 Updated selectors.js: ${selectorKey}.${prop} → ${newSelector}`);
 }
};
// ------------------ HELPER FUNCTIONS ------------------
function normalizeSelector(s) {
 return (s || '').replace(/['"]/g, '').trim();
}