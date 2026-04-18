
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const resDir = '/home/ubuntu/.hermes/mcp/disney-cruise/tests/res';
const files = [
    'LOGIN1.DOM.html',
    'LOGIN1_ERR.DOM.html',
    'LOGIN1_PWD.DOM.html',
    'LOGIN2.DOM.html',
    'OTP1.DOM.html',
    'OTP2.html'
];

files.forEach(file => {
    const filePath = path.join(resDir, file);
    if (!fs.existsSync(filePath)) return;
    const html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html);
    
    console.log(`--- File: ${file} ---`);
    console.log(`Title: ${$('title').text()}`);
    console.log(`Email Input (InputIdentityFlowValue): ${$('#InputIdentityFlowValue').length}`);
    console.log(`Email Input (type=email): ${$('input[type="email"]').length}`);
    console.log(`Password Input (InputPassword): ${$('#InputPassword').length}`);
    console.log(`Password Input (type=password): ${$('input[type="password"]').length}`);
    console.log(`OTP Input (InputRedeemOTP): ${$('#InputRedeemOTP').length}`);
    console.log(`OTP Form (otp-prompt-redeem): ${$('form.otp-prompt-redeem').length}`);
    console.log(`Error Message (.error-message): ${$('.error-message').length}`);
    console.log(`Invalid Feedback (.invalid-feedback): ${$('.invalid-feedback').length}`);
    console.log(`Visible Text contains '6-digit code': ${$('body').text().includes('6-digit code')}`);
    console.log(`Visible Text contains 'Someone Ate the Page!': ${html.includes('Someone Ate the Page!')}`);
});
