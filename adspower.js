const axios = require("axios");

//Функция переименования аккаунта

const accountRename = async (id, name) => {
    const accountUpdateUrl = "http://local.adspower.net:50325/api/v1/user/update";
    await axios.post(accountUpdateUrl, {
        user_id: id,
        name: name,
    });
};

//Функция для получения информации об аккаунте

const getAccountInfo = async (id) => {
    const accountQueryUrl = `http://local.adspower.net:50325/api/v1/user/list?user_id=${id}`;
    const res = await axios.get(accountQueryUrl);
    return res.data.data.list[0];
};

//Функция обновления информации об аккаунте

const addAccountRemark = async (id, remark) => {
    const accountUpdateUrl = "http://local.adspower.net:50325/api/v1/user/update";
    await axios.post(accountUpdateUrl, {
        user_id: id,
        remark: remark,
    });
};


module.exports.accountRename = accountRename;
module.exports.getAccountInfo = getAccountInfo;
module.exports.addAccountRemark = addAccountRemark;
