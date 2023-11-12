/*
 * @Author       : peng.li
 * @Date         : 2023-06-25 11:23:54
 * @LastEditors  : peng.li
 * @LastEditTime : 2023-11-12 15:52:00
 * @FilePath     : \totalmetadrama\Language\ToLanguage.js
 * @Description  : 修改描述
 */

var fs = require('fs');
var path = require('path');
const xlsx = require('node-xlsx');
const { isString } = require('util');

// 获取当前文件所在目录的完整路径
const currentDirectoryPath = __dirname;
const pathJson = currentDirectoryPath.replace("Language", "") + "Language/LanguageConfig.json";
const pathZ = currentDirectoryPath.replace("Language", "") + "JavaScripts";
const pahtExcel = currentDirectoryPath.replace("Language", "") + "Excels/Language_多语言表.xlsx";
const pathUI = currentDirectoryPath.replace("Language", "") + "UI";
const pathAllExcel = currentDirectoryPath.replace("Language", "") + "Excels";

// 读取关卡数据
function readToJson(path) {
    const jsonString = fs.readFileSync(path, "utf8");
    if (jsonString.charCodeAt(0) === 0xFEFF) {
        // Remove BOM from the jsonString
        return JSON.parse(jsonString.slice(1));
    }
    return JSON.parse(jsonString);
}

// 写入对应路径
function writeToJson(path, data) {
    const jsonStr = !isString(data) ? JSON.stringify(data) : data;

    // 添加 UTF-8 BOM
    const bom = Buffer.from('\uFEFF', 'utf8');
    const dataWithBom = Buffer.concat([bom, Buffer.from(jsonStr, 'utf8')]);

    // 写入文件
    fs.writeFileSync(path, dataWithBom);
}


/**
 * 生成下一个id
 */
function genLocalizeId() {
    let languageConfig = readToJson(pathJson);
    languageConfig.genId += 1;
    writeToJson(pathJson, languageConfig);
    return languageConfig.genId;
}

// 尝试改变代码中的多语言函数
function tryChangeScript(dirPath, outResult = {}) {
    return new Promise(async (resolve, reject) => {
        const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

        for (let file of files) {
            const filePath = path.join(dirPath, file); // 文件的完整路径
            const stats = fs.statSync(filePath); // 获取文件信息

            // 如果是文件，则进行处理
            if (stats.isFile()) {
                // 后缀必须是.ts
                if (!filePath.endsWith(".ts")) continue;
                // 读取对应文本
                await new Promise((resolve2, reject2) => {
                    let cb = (coding) => {
                        fs.readFile(filePath, coding, async (err, data) => {
                            if (err) {
                                console.error(err);

                                // 如果当前是utf16le格式，那就不用再试了
                                if (coding === 'utf8') {
                                    cb('utf16le');
                                    return;
                                } else {
                                    return resolve2(false);
                                }
                            }

                            if (data.indexOf('LanUtil.getLanguage(') === -1) return resolve2(false);

                            // 找出代码中所有的调用_LC的函数
                            const matchArr = data.match(/LanUtil.getLanguage\([^)]+\)/g);
                            console.log(matchArr);
                            if (matchArr) {
                                // "LanUtil.getLanguage("内容")";
                                for (let needChangeContext of matchArr) {
                                    let nextId;

                                    // 筛选出带双引号的文本
                                    const regex = /"([^"]*)"/g;

                                    // 单引号
                                    const onlyRegex = /'([^"]*)'/g;

                                    // 取出内容
                                    var matches = needChangeContext.match(regex);
                                    if (!matches) {
                                        matches = needChangeContext.match(onlyRegex);
                                    }

                                    // 这里报错一下
                                    if (!matches) {
                                        console.error("\u001B[31m" + "内容匹配失败，本次收集只替换单引号和双引号！！！\n\rpath: " + filePath + "\n\r内容：\"" + needChangeContext + "\"");
                                    }

                                    const result = matches.map(match => match.slice(1, -1));

                                    // 有没有中文就跳过  如果不是Language表里面的key，那还是要收集
                                    if (!hasChineseCharacters(result[0]) && checkLanguageKey(result[0])) continue;

                                    // 如果表中有这个一样的内容，直接延用之前的内容
                                    let resultCfg = checkLanguage(result[0]);
                                    if (resultCfg) {
                                        nextId = resultCfg.id;
                                    } else {
                                        let isChange = false;
                                        result[0] = result[0].replace(/\r\n/g, "\n");
                                        for (let id in outResult) {
                                            if (outResult[id] === result[0]) {
                                                isChange = true;
                                                nextId = id;
                                            }
                                        }

                                        // 没有改变
                                        if (!isChange) {
                                            // 生成下一个id
                                            nextId = genLocalizeId();

                                            // 设置内容
                                            outResult[nextId] = result[0];
                                        }
                                    }

                                    // 如果代码中有"LanUtil.getLanguage(" 这种的， 直接替换 单双引号都要替换
                                    data = data.replace("LanUtil.getLanguage(\"" + result[0] + "\")", "LanUtil.getLanguage(\"" + "STL_" + nextId + "\")");
                                    data = data.replace("LanUtil.getLanguage(\'" + result[0] + "\')", "LanUtil.getLanguage(\"" + "STL_" + nextId + "\")");
                                }
                            }
                            resolve2(true);

                            console.log(filePath);

                            // 文件写入
                            fs.writeFile(filePath, data, (err) => {
                                if (err) {
                                    console.error(err);
                                    resolve2(false);
                                    return;
                                }

                                console.log('Data written to file successfully.');
                                resolve2(true);
                            });
                        });
                    }

                    // 先试试utf8
                    cb('utf8');
                });
            } else if (stats.isDirectory()) {
                // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
                await tryChangeScript(filePath, outResult);
            }
        }
        resolve(true);
    });
}

// 尝试改变UI中的多语言
function tryChangeUI(dirPath, outResult = {}) {
    return new Promise(async (resolve, reject) => {
        const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

        for (let file of files) {
            const filePath = path.join(dirPath, file); // 文件的完整路径
            const stats = fs.statSync(filePath); // 获取文件信息

            // 如果是文件，则进行处理
            if (stats.isFile()) {
                // 后缀必须是.ui
                if (!filePath.endsWith(".ui")) continue;
                // 读取对应文本
                await new Promise((resolve2, reject2) => {
                    let cb = (coding) => {
                        fs.readFile(filePath, coding, async (err, data) => {
                            if (err) {
                                console.error(err);

                                // 如果当前是utf16le格式，那就不用再试了
                                if (coding === 'utf8') {
                                    cb('utf16 le');
                                    return;
                                } else {
                                    return resolve2(false);
                                }
                            }

                            let isChange = false;

                            // 递归遍历
                            let repCb = (forData) => {
                                for (let key in forData) {
                                    if (key === "Text") {
                                        // 如果发现有中文
                                        if (hasChineseCharacters(forData[key])) {
                                            // 如果表中有这个一样的内容，直接延用之前的内容
                                            let result = checkLanguage(forData[key]);
                                            let uiKey = "";
                                            if (result) {
                                                uiKey = result.key;
                                            } else {
                                                let isContentChange = false;
                                                forData[key] = forData[key].replace(/\r\n/g, "\n");
                                                for (let id in outResult) {
                                                    if (outResult[id] === forData[key]) {
                                                        isContentChange = true;
                                                        uiKey = "UTL_" + id;
                                                    }
                                                }

                                                // 没有改变
                                                if (!isContentChange) {
                                                    // 收集文本，并且生成唯一key值
                                                    let nextId = genLocalizeId();
                                                    uiKey = "UTL_" + nextId;
                                                    outResult[nextId] = forData[key];
                                                }
                                            }
                                            forData[key] = uiKey;
                                            isChange = true;
                                        }
                                    } else if (typeof forData[key] === "object") {
                                        repCb(forData[key]);
                                    }
                                }
                            }

                            let inputData;
                            if (data.charCodeAt(0) === 0xFEFF) {
                                // Remove BOM from the jsonString
                                inputData = JSON.parse(data.slice(1));
                            }
                            else {
                                inputData = JSON.parse(data);
                            }

                            repCb(inputData);
                            if (isChange) {
                                const jsonStr = !isString(inputData) ? JSON.stringify(inputData) : inputData;

                                // 添加 UTF-8 BOM
                                const bom = Buffer.from('\uFEFF', 'utf8');
                                const dataWithBom = Buffer.concat([bom, Buffer.from(jsonStr, 'utf8')]);

                                // 文件写入
                                fs.writeFile(filePath, dataWithBom, (err) => {
                                    if (err) {
                                        console.error(err);
                                        resolve2(false);
                                        return;
                                    }

                                    console.log(filePath);
                                    console.log('Data written to file successfully.');
                                    resolve2(true);
                                });
                            } else {
                                resolve2(true);
                            }
                        });
                    };

                    // 先试试utf8
                    cb('utf8');
                });
            } else if (stats.isDirectory()) {
                // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
                await tryChangeUI(filePath, outResult);
            }
        }
        resolve(true);
    });
}

// 尝试改变Excel中的多语言
function tryChangeExcel(dirPath, outResult = {}) {
    return new Promise(async (resolve, reject) => {
        const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

        for (let file of files) {
            const filePath = path.join(dirPath, file); // 文件的完整路径
            const stats = fs.statSync(filePath); // 获取文件信息

            // 如果是文件，则进行处理
            if (stats.isFile()) {
                // 后缀必须是.xlsx
                if (!filePath.endsWith(".xlsx")) continue;
                // 读取对应文本
                await new Promise((resolve2, reject2) => {
                    if (filePath == pahtExcel) {
                        return reject2(true);
                    }
                    const workSheetsFromFile = xlsx.parse(filePath);
                    if (!workSheetsFromFile) return;
                    let sheet = workSheetsFromFile[0];
                    let sheetData = sheet.data;
                    let isChange = false;

                    // 如果第4个有Language标注
                    for (let index = 0; index < sheetData[2].length; index++) {
                        let title = sheetData[3][index];
                        if (title === "Language") {
                            // 发现了标题为Language的列
                            for (let line = 3; line < sheetData.length; line++) {
                                let content = sheetData[line][index];

                                // 如果是中文
                                if (hasChineseCharacters(content)) {
                                    // 如果表中有这个一样的内容，直接延用之前的内容
                                    let result = checkLanguage(content);
                                    let uiKey = "";
                                    if (result) {
                                        uiKey = result.key;
                                    } else {
                                        let isContentChange = false;
                                        sheetData[line][index] = sheetData[line][index].replace(/\r\n/g, "\n");
                                        for (let id in outResult) {
                                            if (outResult[id] === sheetData[line][index]) {
                                                isContentChange = true;
                                                uiKey = "ETL_" + id;
                                            }
                                        }

                                        // 没有改变
                                        if (!isContentChange) {
                                            // 记录内容，更改内容
                                            let nextId = genLocalizeId();
                                            uiKey = "ETL_" + nextId;
                                            outResult[nextId] = sheetData[line][index];
                                        }
                                    }
                                    sheetData[line][index] = uiKey;
                                    isChange = true;
                                }
                            }
                        }
                    }

                    // 改变了就写入
                    if (isChange) {
                        console.log(filePath);
                        let need = [{ name: sheet.name, data: sheetData }];
                        const buffer = xlsx.build(need);
                        fs.writeFileSync(filePath, buffer);
                        resolve2(true);
                    } else {
                        resolve2(true);
                    }
                });
            } else if (stats.isDirectory()) {
                // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
                await tryChangeExcel(filePath, outResult);
            }
        }
        resolve(true);
    });
}

// 识别是否有中文
function hasChineseCharacters(text) {
    var chineseRegex = /[\u4e00-\u9fff]/;
    return chineseRegex.test(text);
}

// 初始化当前的id
function initLanguageId() {
    const workSheetsFromFile = xlsx.parse(pahtExcel);
    if (!workSheetsFromFile) return;
    let sheet = workSheetsFromFile[0];
    let sheetData = sheet.data;

    // 多语言表的最后一位的id
    let id = 0;
    for (let info of sheetData) {
        if (info.length > 0 && typeof info[0] === "number" && info[0] > id) {
            id = info[0];
        }
    }
    let languageConfig = readToJson(pathJson);
    languageConfig.genId = id;
    writeToJson(pathJson, languageConfig);
}

// 写入Language表
function wirteToLanguage(keyPrefix, result, isEnd = false) {
    const workSheetsFromFile = xlsx.parse(pahtExcel);
    if (!workSheetsFromFile) return;
    let sheet = workSheetsFromFile[0];
    const sheetName = sheet.name;
    let sheetData = sheet.data;

    // 代码中编号对应的内容替换表中的
    let info = {};
    for (let index = 4; index < sheetData.length; index++) {
        let context = sheetData[index];
        info[context[0]] = context;
    }

    // 找到中文翻译的索引
    let chineseIndex = sheetData[3].findIndex(value => value === "ChildLanguage");
    for (let idx in result) {
        if (info[idx]) {
            info[idx][chineseIndex] = result[idx];
        } else {
            let key = keyPrefix + idx;
            sheetData.push([+idx, key, "", result[idx]]);
        }
    }

    let need = [{ name: sheet.name, data: sheetData }];
    const buffer = xlsx.build(need);
    fs.writeFileSync(pahtExcel, buffer);

    if (!isEnd) {
        console.log("写入表格成功，请等待。。。");
    } else {
        console.log("写入表格成功，全部结束");
    }
}

// 1: {id: 1, key: UI_1001, value: "你好"}
var languageConfigData = {};

// 读Language表
function readLanguage() {
    const workSheetsFromFile = xlsx.parse(pahtExcel);
    if (!workSheetsFromFile) return;
    let sheet = workSheetsFromFile[0];
    let sheetData = sheet.data;

    // 代码中编号对应的内容替换表中的
    let info = {};
    for (let index = 4; index < sheetData.length; index++) {
        let context = sheetData[index];
        info[context[0]] = context;
    }

    for (let i = 4; i < sheetData.length; i++) {
        if (!sheetData[i][0]) continue;
        languageConfigData[sheetData[i][0]] = { id: sheetData[i][0], key: sheetData[i][1], value: sheetData[i][3] };
    }

    console.log(languageConfigData);
}

// 多语言表中是否有当前内容一致的
function checkLanguage(content) {
    // 如果这个里面有\r\n，就替换成\n
    content = content.replace(/\r\n/g, "\n");
    for (let id in languageConfigData) {
        if (languageConfigData[id].value === content) {
            return languageConfigData[id];
        }
    }
    return null;
}

// 多语言表中是否有当前可以是否一致的
function checkLanguageKey(key) {
    // 如果这个里面有\r\n，就替换成\n
    key = key.replace(/\r\n/g, "\n");
    for (let id in languageConfigData) {
        if (languageConfigData[id].key === key) {
            return languageConfigData[id];
        }
    }
    return null;
}

// ---------------------------------------------------------------执行逻辑分割线---------------------------------------------------------------------

// 初始化多语言的id
initLanguageId();

readLanguage();

// 结构 {1: "你好"}
var collectUILanguage = {};
tryChangeUI(pathUI, collectUILanguage).then(() => {
    console.log(collectUILanguage);

    // 写入Language_多语言表.xlsx
    wirteToLanguage("UTL_", collectUILanguage);

    readLanguage();

    var collectExcelLanguage = {};
    tryChangeExcel(pathAllExcel, collectExcelLanguage).then(() => {
        console.log(collectExcelLanguage);

        // 写入Language_多语言表.xlsx
        wirteToLanguage("ETL_", collectExcelLanguage);

        readLanguage();

        // 读取文件，写入文本
        var collectScroptResult = {};

        // 转换脚本
        tryChangeScript(pathZ, collectScroptResult).then(() => {
            console.log("转脚本完成");
            console.log(collectScroptResult);
            wirteToLanguage("STL_", collectScroptResult, true);
        });
    });
});