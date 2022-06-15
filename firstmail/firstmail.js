const colors = require('simple-log-colors')

async function isMailValid(page, login, password) {
    console.log(`${colors.magenta('Проверяю валидность почты...')}`)
    try {
        await page.goto('http://zaushholding.space/webmail/')
            .catch(async () => await page.goto('http://zaushholding.space/webmail/'))
        await page.waitForXPath(`//span[@id="selenium_logout_button"]`, {timeout: 7000}).then(async logout => await logout.click()).catch(() => {
            return;
        })
        const inputLogin = await page.waitForXPath(`//input[@id="selenium_login_email"]`, {timeout: 20000})
        await inputLogin.type(login, {delay: 10})
        await page.waitForTimeout(1000)
        const inputPassword = await page.waitForXPath(`//input[@id="selenium_login_password"]`, {timeout: 20000})
        await inputPassword.type(password, {delay: 10})
        await page.waitForTimeout(1000)
        const buttonSubmit = await page.waitForXPath(`//button[@id="selenium_login_signin_button"]`, {timeout: 20000})
        await buttonSubmit.click()
        await page.waitForTimeout(1000)
        const logoutButton = await page.waitForXPath(`//span[@id="selenium_logout_button"]`)
        await logoutButton.click()
        await page.waitForTimeout(1000)
        return 'VALID'
    } catch (e) {
        try {
            await page.waitForXPath(`//button[@id="selenium_login_signin_button"]`, {timeout: 20000})
            return 'NO VALID'
        } catch (err) {
            await page.waitForXPath('//div[@class="folders"]')
            return 'VALID'
        }
    }
}

async function main(page, login, password) {

    const checkInbox = async () => {
        try {
            await page.waitForXPath(`//span[contains(text(),"На Facebook добавлен новый эл. адрес")]`, {timeout: 20000})
            return 'OK'
        } catch (err) {
            console.log(colors.magenta('Письмо не пришло проверяю еще раз'))
            await page.waitForXPath(`//span[@id="selenium_mail_check_button"]`).then(async refresh => await refresh.click())
            return 'EMPTY'
        }
    }

    const checkInboxRetry = async () => {
        let currentTry = 0;
        while (true) {
            if (currentTry > 6) {
                console.log('Код подтверждения не пришел')
                return false
                break
            }
            try {
                const inboxStatus = await checkInbox()
                if (inboxStatus === 'OK') {
                    return inboxStatus;
                    break
                }
                currentTry++;
            } catch (err) {
                console.log('При попытке проверки входящих писем пошло что то не так проверяю еще.', err)
                currentTry++;
            }
        }
    }

    //Авторизация
    const authorization = async () => {
        try {
            await page.goto('http://zaushholding.space/webmail/')
                .catch(async () => await page.goto('http://zaushholding.space/webmail/'))
            await page.waitForXPath(`//input[@id="selenium_login_email"]`, {timeout: 20000}).then(async inputLogin => await inputLogin.type(login, {delay: 10}))
            await page.waitForXPath(`//input[@id="selenium_login_password"]`, {timeout: 20000}).then(async inputPassword => await inputPassword.type(password, {delay: 10}))
            await page.waitForXPath(`//button[@id="selenium_login_signin_button"]`, {timeout: 20000}).then(async buttonSubmit => await buttonSubmit.click())
        } catch (e) {
            await page.waitForXPath('//div[@class="folders"]').then(() => console.info(colors.yellow('Уже авторизован')))
        }
    }
    //\Авторизация

    await authorization();

    let isMail = await checkInboxRetry();

    if (isMail !== "OK") {
        await page.goto('https://www.facebook.com/settings?tab=account&section=email')
        const frame = await (await page.waitForXPath(`//iframe`)).contentFrame()
        const emailResendLink = await frame.waitForXPath(`//a[@class="SettingsEmailPendingResend"]`)
        await emailResendLink.click()
        await authorization();
        isMail = await checkInboxRetry();
    }

    if (isMail === 'OK') {

        const emailLink = await page.waitForXPath(`//span[contains(text(),"На Facebook добавлен новый эл. адрес")]/../../../..`)
        await emailLink.click()
        await page.waitForTimeout(1000)
        const letterLine = await page.waitForXPath(`//span[contains(text(),'Вас могут попросить ввести этот код подтверждения:')]`, {visible: true})
        const verMessage = await letterLine.evaluate(() => {
            return document.querySelector('#pSevenContent > div.screens > div.screen.MailLayout > div > div.panel_helper > div.panel.item_viewer.message_viewer > div > div > div.panel_center > div.panels > div.panel.left_panel > div > div.message_content.scroll-inner > div.message_body.html > div > table > tbody > tr > td > table > tbody > tr:nth-child(4) > td:nth-child(2) > table > tbody > tr:nth-child(8) > td > span').innerText
        })

        const verCode = (verMessage.match(/\d{5}/gm))[0]
        console.log(verCode)
        return verCode;

    } else {
        console.log(colors.redBackground('Не удалось получить код!!!'))
        return 'NO CODE'
    }

}

module.exports.getCode = main;
module.exports.isMailValid = isMailValid;