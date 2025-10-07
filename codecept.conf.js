require('dotenv').config();
const axios = require('axios');
const { setHeadlessWhen, setCommonPlugins } = require('@codeceptjs/configure');
// turn on headless mode when running with HEADLESS=true environment variable
// export HEADLESS=true && npx codeceptjs run
setHeadlessWhen(process.env.HEADLESS);

// enable all common plugins https://github.com/codeceptjs/configure#setcommonplugins
setCommonPlugins();

/** @type {CodeceptJS.MainConfig} */
exports.config = {
  tests: './*_test.js',
  output: './output',
  helpers: {
    Playwright: {
      browser: 'chromium',
      url: 'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login',
      show: true,
      windowSize: '1200x900',
      waitForTimeout: 10000,
      waitForAction: 10000,
      waitForNavigation: 'load',
      restart: false,
      keepCookies: true,
      keepBrowserState: true
    },
    SelfHealingHelper: {
      require: './heal.js'
    }
  },
  include: {
    I: './steps_file.js',

    
  },
  // Require the heal plugin
};
require('./heal');
exports.config.plugins = {
    heal: {
        enabled: true
    },
  retryFailedStep: {
    enabled: true
  }
};
exports.config.name = 'selfHealing';
  ai: {
    request: async (messages) => {
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
      const body = {
        contents: [
          {
            parts: [
              { text: messages.map(m => m.content).join('\n') }
            ]
          }
        ]
      };
      const response = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' }
      });
      // Adjust this based on Gemini's response structure
      return response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  }

// ai: {
//   request: async () => {
//     return 'AI healing is handled by custom logic.';
//   }
//}
