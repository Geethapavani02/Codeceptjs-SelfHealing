Feature('login');

Scenario('Login page',  ({ I }) => {
delete require.cache[require.resolve('./selectors.js')];
    const selectors = require('./selectors.js');
    I.amOnPage('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');
    I.fillField(selectors.username, 'Admin');
    I.fillField(selectors.password, 'admin123');
    I.click(selectors.loginButton);
    I.wait(60)
    I.see('Dashboard');
});
