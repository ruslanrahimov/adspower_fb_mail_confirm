const axios = require("axios");
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const zaush = require("./firstmail/firstmail");
const adspower = require("./adspower");
const colors = require("simple-log-colors");

async function mailConfirm(id) {
    const res = await axios.get(`http://local.adspower.net:50325/api/v1/browser/start?user_id=${id}&launch_args=["--start-maximized","--window-size=1920,1080","--disable-web-security","--disable-features=IsolateOrigins,site-per-process"]`);

    if (res.data.code === 0 && res.data.data.ws && res.data.data.ws.puppeteer) {
        const browser = await puppeteer.connect({
            browserWSEndpoint: res.data.data.ws.puppeteer, defaultViewport: null,
        });
        const page = await browser.newPage();
        //Данные для входа в сервис zaush.ru
        const mailData = fs
            .readFileSync(path.resolve(__dirname, "src", "data.txt"), "utf-8")
            .split("\r\n");
        const emailAddress = mailData[0].split(":")[0];
        const emailPassword = mailData[0].split(":")[1];
        //\Данные для входа в сервис zaush.ru

        //Данные аккаунта
        const userData = await adspower.getAccountInfo(id);
        const remarkItems = userData.remark.split("|");
        const accountPassword = remarkItems[1];
        //\Данные аккаунта

        console.log(`${colors.blue("Подтверждаю аккаунт: ")} ${colors.magenta(userData.name)}`);

        try {
            const mailValidStatus = await zaush.isMailValid(page, emailAddress, emailPassword)
            if (mailValidStatus === 'NO VALID') {
                console.log(`${colors.red('Неправильные эл. почта, логин и/или пароль. Неудачная аутентификация.')}`)
                return {
                    status: mailValidStatus, mailData, browser
                }
            }
            console.log(mailValidStatus)

            await page.goto("https://www.facebook.com/settings?tab=account&section=email").catch(async () => {
                await page.goto("https://www.facebook.com/settings?tab=account&section=email")
            })

            console.log("Почта для подтверждения: ", colors.yellow(emailAddress));

            let iframe = await (await page.waitForXPath(`//iframe`)).contentFrame();
            await page.waitForTimeout(1000)
            const mailChangeLink = await iframe.waitForXPath(`//div[@class="ptm"]/div/div/a`);
            await mailChangeLink.click();
            await page.waitForTimeout(1000)
            const newMailInput = await iframe.waitForXPath(`//input[@name="new_email"]`);
            await newMailInput.type(emailAddress, {delay: 10});

            await page.waitForTimeout(2000);
            const submitFormButton = await iframe.waitForXPath(`(//button[@type="submit"])[2]`, {visible: true});
            await submitFormButton.click({delay: 10});
            await page.waitForTimeout(2000)
            try {
                const accountPasswordConfirm = await iframe.waitForXPath(`//input[@id="ajax_password"]`);
                await accountPasswordConfirm.type(accountPassword, {delay: 10});
                await page.waitForTimeout(1000)
                const accountPasswordConfirmBtn = await iframe.waitForXPath(`//button[@data-testid="sec_ac_button"]`);
                await accountPasswordConfirmBtn.click();
                await page.waitForTimeout(1000)
            } catch (e) {
                console.log('Подтверждение паролем не нужно')
            }

            try{
                let closeButton = await iframe.waitForXPath(`//div[@class="_5lnf uiOverlayFooter _5a8u"]/a`);
                await closeButton.click();
            }catch (e) {
                await iframe.waitForXPath(`//div[@id="ajax_error_msg"]`)
                return {
                    status: "PASSWORD ERROR", browser: browser, userData: userData,
                };
            }
            await page.waitForTimeout(1000)
            console.info(colors.cyan("Иду получать код подтверждения"));

            const verCode = await zaush.getCode(page, emailAddress, emailPassword);
            await page.waitForTimeout(1000)
            if (verCode === "NO CODE") {
                return {
                    status: verCode, browser: browser, userData: userData,
                };
            }

            await page.goto("https://www.facebook.com/settings?tab=account&section=email")
                  .catch(async () => await page.goto("https://www.facebook.com/settings?tab=account&section=email"));

            iframe = await (await page.waitForXPath(`//iframe`)).contentFrame();

            const confirmButton = await iframe.waitForXPath(`//a[@class="_42ft _42fu SettingsEmailPendingConfirm"]`);
            await confirmButton.click();
            await page.waitForTimeout(1000)
            const codeInput = await iframe.waitForXPath(`//input[@id="code"]`);
            await codeInput.type(verCode, {delay: 10});
            await page.waitForTimeout(1000)
            const codeSubmitButton = await iframe.waitForXPath(`//button[text()="ОК"]`);
            await codeSubmitButton.click();
            await page.waitForTimeout(1000)
            let closeButton = await iframe.waitForXPath(`//a[text()='Закрыть']`);
            await closeButton.click();
            await page.waitForTimeout(1000)
            console.log(colors.greenBackground(colors.black("Почта подтверждена!")));

            await adspower.addAccountRemark(id, `${userData.remark}|${emailAddress}|${emailPassword}`);
            console.log(`${colors.green("REMARK: ")} ${colors.cyan(`${userData.remark}|${emailAddress}|${emailPassword}`)}`);

            mailData.shift();
            fs.writeFileSync(path.resolve(__dirname, "src", "data.txt"), mailData.join("\r\n"));

            return {
                status: "OK", browser: browser, userData: userData,
            };
        } catch (err) {
            try {
                await page.waitForXPath(`//span[contains(text(),"ваш аккаунт заблокирован") or contains(text(),"Мы временно заблокировали ваш аккаунт")]`, {timeout: 15000});
                return {
                    status: "CHECK", browser: browser, userData: userData,
                };
            } catch (e) {
                console.log(`${colors.red("Что то пошло не так: ")} ${colors.blue(err)}`);
            }
        }
    }
}

let idList = fs.readFileSync("./src/id.txt", "utf-8").split("\r\n");

const delay = async (ms) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
};

(async () => {
    if (idList.length < 1 || idList[0] === "") {
        console.log(`${colors.red("Список айди пуст!")}`);
        return;
    }
    for (const id of idList) {
        try {
            const mailConfirmResult = await mailConfirm(id);

            switch (mailConfirmResult.status) {
                case 'OK':
                    console.log(`${colors.red(`Переименовал аккаунт как ${mailConfirmResult.userData.name} EMAIL_CONFIRM`)}`);
                    await delay(2000);
                    await adspower.accountRename(id, `${mailConfirmResult.userData.name} EMAIL_CONFIRM`);
                    await delay(3000);
                    idList = idList.filter((item) => item !== id);
                    fs.writeFileSync("./src/id.txt", idList.join("\r\n"));
                    await mailConfirmResult.browser.close();
                    break;
                case 'NO CODE':
                    console.log(`${colors.red("Не получилось получить код подтверждения")}`);
                    await mailConfirmResult.browser.close();
                    break;
                case 'CHECK':
                    console.log(`${colors.red(`Аккаунт улетел на чек! Переименую как ${mailConfirmResult.userData.name} CHECK`)}`);
                    await adspower.accountRename(id, `${mailConfirmResult.userData.name} CHECK`);
                    idList = idList.filter((item) => item !== id);
                    fs.writeFileSync("./src/id.txt", idList.join("\r\n"));
                    await mailConfirmResult.browser.close();
                    break;
                case 'NO VALID':
                    console.log(`${colors.red('Удаляю невалидную почту...')}`)
                    mailConfirmResult.mailData.shift();
                    fs.writeFileSync(path.resolve(__dirname, "src", "data.txt"), mailConfirmResult.mailData.join("\r\n"));
                    await mailConfirmResult.browser.close()
                    break
                case 'PASSWORD ERROR':
                    console.log(`${colors.red(`Неверный пароль аккаунта ФБ! Переименую как ${mailConfirmResult.userData.name} PASSWORD_ERROR`)}`);
                    await adspower.accountRename(id, `${mailConfirmResult.userData.name} PASSWORD_ERROR`);
                    idList = idList.filter((item) => item !== id);
                    fs.writeFileSync("./src/id.txt", idList.join("\r\n"));
                    await mailConfirmResult.browser.close()
                    break
            }

        } catch (err) {
            console.log(err);
        }
    }
})();
