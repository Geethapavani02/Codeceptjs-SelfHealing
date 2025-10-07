const { heal, ai } = require('codeceptjs');
const Helper = require('@codeceptjs/helper');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

console.log("SelfHealingHelper loaded successfully.");

heal.addRecipe('ai', {
  priority: 10,
  prepare: {
    html: ({ I }) => I.grabHTMLFrom('body'),

  },
  suggest: true,
  steps: ['click', 'fillField', 'appendField', 'selectOption', 'attachFile', 'checkOption', 'uncheckOption', 'doubleClick'],
  fn: async args => ai.healFailedStep(args),
});
// heal.addRecipe('click', {
  // priority: 2,
  //steps: ['fillField', 'appendField'],
  // steps:['click'],
  // fn: async ({ step }) => {
  //   console.log("Executing click recipe............");
  //   const locator = step.args[0]
  //   //const text = step.args[1]
  //   let i = 1
  //   return ({ I }) => {

  //     console.log(i++, `Clicking on locator..>>>>>>>>>>>: ${locator} and typing text: ${text}`);
  //     I.click(locator)
  //     I.wait(1) // to open modal or something
  //     //I.type(text)
  //   }
  // },
// });

heal.addRecipe('Click', {
  priority: 2,
  steps: ['Click'],
  fn: async ({ step }) => {
    console.log("Executing click recipe............");
    const locator = step.args[0]
    let i = 1
    return ({ I }) => {

      console.log(i++, `Clicking on locator..>>>>>>>>>>>: ${locator}`);
      I.click(locator)
      I.wait(1) // to open modal or something
    }
  },
});

// heal.addRecipe('reload_on_click_fail', {
//   priority: 1,
//   steps: ['click'],
//   fn: async () => {
//     return ({ I }) => {
//       I.refreshPage(); // Try refreshing the page
//     };
//   },
// });
// heal.addRecipe('onlyFillField', {
//   priority: 10,
//   steps: ['fillField'],
//   fn: async ({ step }) => {
//     const locator = step.args[0];
//     const value = step.args[1];
//     return ({ I }) => {
//       console.log('I fill field', locator); // <-- This will print the locator
//       I.fillField(locator, value);
//     };
//   },
//

module.exports = {
  heal
};

module.exports = class SelfHealingHelper extends Helper {
  async _failed(test) {
    console.log("\n[Self-Healing] Test failed. Attempting GenAI healing--- inside _failed...");
    const errMsg = test.err?.message || '';
    if (errMsg.includes("Clickable") || errMsg.includes("Locator")) {
      console.log("\n[Self-Healing] Selector not found. Attempting GenAI fix...");

      const selectors = require('./selectors.js');
      const uiActions = [
        'click', 'fillField', 'appendField', 'selectOption', 'attachFile',
        'checkOption', 'uncheckOption', 'doubleClick'
      ];
      const failedSteps = [];

      for (let i = test.steps.length - 1; i >= 0; i--) {
        const step = test.steps[i];
        console.log("\n[Self-Healing] Processing steeeeeeeeeep:", i);
        console.log(i, "step pppppppppppppppp", step.name, step.args);
        console.log(uiActions.includes(step.name))
        if (uiActions.includes(step.name) && step.actor === 'I') {
          failedSteps.push(step);
        }
      }

      const I = this.helpers.Playwright;

      for (const failedStep of failedSteps) {
        let failedSelector = null;
        if (failedStep?.args) {
          if (typeof failedStep.args[0] === 'string') {
            failedSelector = failedStep.args[0];
          } else if (typeof failedStep.args[0] === 'object') {
            failedSelector = failedStep.args[0].css || failedStep.args[0].xpath || JSON.stringify(failedStep.args[0]);
          }
        }

        let selectorKey = null;
        if (failedSelector) {
          console.log(`[Self-Healing] Failed selector: ${failedSelector}`);
          for (const key in selectors) {
            if (
              (selectors[key].css && normalizeSelector(selectors[key].css) === normalizeSelector(failedSelector)) ||
              (selectors[key].xpath && selectors[key].xpath === failedSelector)
            ) {
              selectorKey = key;
              break;
            }
          }

          if (!selectorKey && test.title) {
            const titleKey = test.title.toLowerCase().replace(/\s+/g, '');
            if (selectors[titleKey]) selectorKey = titleKey;
          }

          console.log(`[Self-Healing] Detected selector key::::: ${selectorKey}`);
        }

        const selectorToCheck = selectorKey && selectors[selectorKey];
        const selectorValue = selectorToCheck?.css || selectorToCheck?.xpath;

        let shouldHeal = true;
        if (selectorValue) {
          const visibleCount = await I.grabNumberOfVisibleElements(selectorValue);
          if (visibleCount > 0) {
            console.log(`[Self-Healing] Element for selector key "${selectorKey}" is visible. Skipping GenAI healing.`);
            shouldHeal = false;
          } else {
            console.log(`[Self-Healing] Element for selector key "${selectorKey}" is NOT visible. Proceeding with GenAI healing.`);
            shouldHeal = true;
          }
        }

        if (!selectorKey || shouldHeal) {
          const suggestion = await this.getAlternativeSelector(test, selectorKey);
          console.log("\n[GenAI Suggestion]");
          console.log(suggestion);

          const { key, type, selector } = await this.parseSelectorLine(suggestion);
          const finalKey = selectorKey || (key !== 'null' ? key : null);
          if (!finalKey) {
            console.warn('[Self-Healing] Selector key is null. Skipping update.');
            continue;
          }

          await this.updateSelectorKeyValue(finalKey, selector, type);
          console.log(`[Self-Healing] Updated selector: ${finalKey} → ${selector} ${type}`);
          

        const selectorsPath = './selectors.js';

for (let attempt = 1; attempt <= 1; attempt++) {
  console.log(`[Self-Healing] Retry attempt ${attempt} of 2`);
  try {
    // Reload selectors to get the latest updates
    delete require.cache[require.resolve(selectorsPath)];
    const updatedSelectors = require(selectorsPath);

    for (const step of failedSteps) {
      const name = step.name;
      const args = [...step.args];
console.log(`[Self-Healing] Retrying step: ${name} with args: ${JSON.stringify(args)}`);
console.log(`[Self-Healing] Updated selectors if condition:`, finalKey && updatedSelectors[finalKey]);    
// Patch the first argument if it's a selector object or string
      if (finalKey && updatedSelectors[finalKey]) {
        const updatedSelector = updatedSelectors[finalKey];
        console.log(`[Self-Healing] Updated selector to use:`, updatedSelector);
        args[0] = updatedSelector.css || updatedSelector.xpath || args[0];
      }
console.log(`[Self-Healing]  if condition for retry`, typeof I[name] === 'function');
      if (typeof I[name] === 'function') {
        await I[name](...args);
        console.log(`[Self-Healing] Successfully retried step: ${name} with args: ${JSON.stringify(args)}`);
      } else {
        console.warn(`[Self-Healing] Unknown step: ${name}. Skipping.`);
      }
    }


    break; // Exit loop if successful
  } catch (err) {
    console.error(`[Self-Healing] Retry attempt ${attempt} failed:`, err);
    if (attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 2));
    } else {
      console.warn('[Self-Healing] Retry limit reached. Giving up.');
    }
  }
}


        }
      }
    }
  }


  async parseSelectorLine(line) {
    // Matches: key: { css: ("selector") } or key: { xpath: ('selector') }
    const regex = /^(\w+)\s*:\s*\{\s*(css|xpath)\s*:\s*\(\s*(['"])(.*?)\3\s*\)\s*\}/;
    const match = line.match(regex);

    if (!match) {
      throw new Error('Invalid selector format');
    }

    return {
      key: match[1],
      type: match[2],
      selector: match[4],
    };
  }


  async getAlternativeSelector(test, selectorKey) {
    const failingStep = test.err.stack.split('\n').slice(0, 3).join('\n');
    const I = this.helpers.Playwright;
    const html = await I.grabHTMLFrom('body');
    const selectors = require('./selectors.js');

    const prompt = `
A CodeceptJS test using Playwright failed due to a broken selector. Here's the error trace:

${failingStep}

Here is the HTML of the page body at the time of failure:

${html}

The selector key for this element is: "${selectorKey}"

Suggest a working alternative selector (CSS or XPath) that would correctly identify the element.
Respond in the following format, using the provided key exactly:

${selectorKey}: { <type>: ("<selector>") }

Only return the selector line in that format. Do not include any explanation or extra text.
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const selectorLine = response.text().trim();
    console.log(`[Self-Healing] GenAI response:----- ${selectorLine}`);
    console.log(`[Self-Healing] GenAI response type:`, await this.parseSelectorLine(selectorLine));

    const { key, type, selector } = await this.parseSelectorLine(selectorLine);

    await this.updateSelectorKeyValue(selectorKey, selector, type);

    return selectorLine;
  }



  async updateSelectorKeyValue(selectorKey, newSelector, prop) {
    const selectorsPath = path.resolve(__dirname, './selectors.js');
    if (!selectorKey) {
      console.warn('[Self-Healing] Selector key is null. Skipping update.');
      return;
    }

    try {
      let content = await fs.readFile(selectorsPath, 'utf-8');

      const regex = new RegExp(
        `(${selectorKey}\\s*:\\s*\\{[^}]*?${prop}\\s*:\\s*)\\((["']).*?\\2\\)`,
        'g'
      );

      if (!regex.test(content)) {
        console.warn(`[Self-Healing] Key "${selectorKey}" with property "${prop}" not found in selectors.js`);
        return;
      }

      const replacement = `$1("${newSelector}")`;
      const newContent = content.replace(regex, replacement);

      await fs.writeFile(selectorsPath, newContent, 'utf-8');
      console.log(`[Self-Healing] selectors.js updated: ${selectorKey}.${prop} → ${newSelector}`);

      delete require.cache[require.resolve('./selectors.js')];
    } catch (err) {
      console.error('[Self-Healing] Error updating selectors.js:', err);
    }
  }

}

function normalizeSelector(s) {
  return (s || '').replace(/['"]/g, '').trim();
}
